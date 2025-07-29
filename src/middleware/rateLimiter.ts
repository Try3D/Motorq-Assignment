import { Request, Response, NextFunction } from 'express';
import pool from '../database/connection';
import { AuthenticatedRequest } from './vehicleAuth';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  private async ensureTableExists(client: any): Promise<boolean> {
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS vehicle_request_logs (
          id SERIAL PRIMARY KEY,
          vehicle_vin INTEGER NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          endpoint VARCHAR(255) NOT NULL,
          ip_address INET,
          FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin)
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_vehicle_request_logs_vin_timestamp 
        ON vehicle_request_logs(vehicle_vin, timestamp DESC)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_vehicle_request_logs_timestamp 
        ON vehicle_request_logs(timestamp)
      `);

      return true;
    } catch (error) {
      console.error('Error ensuring rate limit table exists:', error);
      return false;
    }
  }

  middleware = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.vehicle) {
        res.status(401).json({ error: 'Vehicle not authenticated' });
        return;
      }

      const vehicleVin = req.vehicle.vin;
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.config.windowMs);

      console.log(`🔍 Rate limiting check for vehicle ${vehicleVin}, window: ${this.config.windowMs}ms, max: ${this.config.maxRequests}`);

      const client = await pool.connect();
      
      try {
        const tableExists = await this.ensureTableExists(client);
        
        if (!tableExists) {
          console.warn('Rate limiter table creation failed, allowing request to proceed');
          next();
          return;
        }

        const countResult = await client.query(`
          SELECT COUNT(*) as request_count
          FROM vehicle_request_logs
          WHERE vehicle_vin = $1 
          AND timestamp >= $2
        `, [vehicleVin, windowStart]);

        const currentCount = parseInt(countResult.rows[0].request_count) || 0;
        console.log(`📊 Vehicle ${vehicleVin}: ${currentCount}/${this.config.maxRequests} requests in window`);

        await client.query(`
          INSERT INTO vehicle_request_logs (vehicle_vin, timestamp, endpoint, ip_address)
          VALUES ($1, $2, $3, $4)
        `, [vehicleVin, now, req.originalUrl, req.ip]);

        if (currentCount >= this.config.maxRequests) {
          console.log(`🚫 Rate limit exceeded for vehicle ${vehicleVin}: ${currentCount}/${this.config.maxRequests}`);
          
          res.status(429).json({
            error: this.config.message,
            rateLimitExceeded: true,
            currentCount: currentCount + 1,
            limit: this.config.maxRequests,
            windowMs: this.config.windowMs,
            resetTime: new Date(now.getTime() + this.config.windowMs),
            retryAfter: Math.ceil(this.config.windowMs / 1000)
          });
          return;
        }

        if (Math.random() < 0.01) {
          const cleanupTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const cleanupResult = await client.query(`
            DELETE FROM vehicle_request_logs 
            WHERE timestamp < $1
          `, [cleanupTime]);
          
          if (cleanupResult.rowCount && cleanupResult.rowCount > 0) {
            console.log(`🧹 Cleaned up ${cleanupResult.rowCount} old rate limit logs`);
          }
        }

        res.set({
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, this.config.maxRequests - currentCount - 1).toString(),
          'X-RateLimit-Reset': Math.ceil((now.getTime() + this.config.windowMs) / 1000).toString(),
          'X-RateLimit-Window': (this.config.windowMs / 1000).toString()
        });

        console.log(`✅ Request allowed for vehicle ${vehicleVin}`);
        next();
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Rate limiting error:', error);
      console.warn('Rate limiter failed, allowing request to proceed');
      next();
    }
  };

  static createTelemetryLimiter(): RateLimiter {
    return new RateLimiter({
      windowMs: 10 * 1000,
      maxRequests: 5,
      message: 'Too many telemetry requests. Maximum 5 requests per 10 seconds allowed.'
    });
  }

  static createGeneralLimiter(): RateLimiter {
    return new RateLimiter({
      windowMs: 30 * 1000,
      maxRequests: 10,
      message: 'Too many requests. Maximum 10 requests per 30 seconds allowed.'
    });
  }

  static createBatchLimiter(): RateLimiter {
    return new RateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 2, 
      message: 'Too many batch requests. Maximum 2 batch operations per minute allowed.'
    });
  }
}

export class RateLimitMonitor {
  static async getVehicleRateStats(vehicleVin: number): Promise<any> {
    const client = await pool.connect();
    
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'vehicle_request_logs'
        )
      `);

      if (!tableCheck.rows[0].exists) {
        return {
          vehicleVin,
          requestsLastHour: 0,
          requestsLastDay: 0,
          error: 'Rate limiting table not initialized'
        };
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const statsResult = await client.query(`
        SELECT 
          COUNT(CASE WHEN timestamp >= $2 THEN 1 END) as requests_last_hour,
          COUNT(CASE WHEN timestamp >= $3 THEN 1 END) as requests_last_day,
          MIN(timestamp) as first_request,
          MAX(timestamp) as last_request,
          COUNT(DISTINCT endpoint) as unique_endpoints
        FROM vehicle_request_logs
        WHERE vehicle_vin = $1
      `, [vehicleVin, oneHourAgo, oneDayAgo]);

      const endpointResult = await client.query(`
        SELECT 
          endpoint,
          COUNT(*) as request_count
        FROM vehicle_request_logs
        WHERE vehicle_vin = $1 AND timestamp >= $2
        GROUP BY endpoint
        ORDER BY request_count DESC
      `, [vehicleVin, oneDayAgo]);

      const stats = statsResult.rows[0] || {};
      
      return {
        vehicleVin,
        requestsLastHour: parseInt(stats.requests_last_hour) || 0,
        requestsLastDay: parseInt(stats.requests_last_day) || 0,
        firstRequest: stats.first_request,
        lastRequest: stats.last_request,
        uniqueEndpoints: parseInt(stats.unique_endpoints) || 0,
        endpointBreakdown: endpointResult.rows,
        generatedAt: now
      };
    } finally {
      client.release();
    }
  }

  static async getTopRequesters(limit: number = 10): Promise<any> {
    const client = await pool.connect();
    
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'vehicle_request_logs'
        )
      `);

      if (!tableCheck.rows[0].exists) {
        return {
          topRequesters: [],
          error: 'Rate limiting table not initialized'
        };
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const result = await client.query(`
        SELECT 
          vrl.vehicle_vin,
          v.manufacturer,
          v.fleet_id,
          COUNT(*) as requests_last_hour,
          MAX(vrl.timestamp) as last_request
        FROM vehicle_request_logs vrl
        JOIN vehicles v ON vrl.vehicle_vin = v.vin
        WHERE vrl.timestamp >= $1
        GROUP BY vrl.vehicle_vin, v.manufacturer, v.fleet_id
        ORDER BY requests_last_hour DESC
        LIMIT $2
      `, [oneHourAgo, limit]);

      return {
        topRequesters: result.rows,
        timeframe: '1 hour',
        generatedAt: new Date()
      };
    } finally {
      client.release();
    }
  }
}
