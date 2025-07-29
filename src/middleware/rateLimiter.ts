import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './vehicleAuth';
import { CacheService, CacheKeys } from '../services/cacheService';
import pool from '../database/connection';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private cache: CacheService;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.cache = CacheService.getInstance();
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
      const endpoint = req.route?.path || req.path;
      const rateLimitKey = CacheKeys.rateLimit(vehicleVin, endpoint);
      
      console.log(`🔍 Redis sliding window rate limiting check for vehicle ${vehicleVin} on ${endpoint}`);

      // Use the enhanced sliding window with analytics
      const result = await this.cache.checkRateLimitWithAnalytics(
        rateLimitKey,
        this.config.maxRequests,
        Math.ceil(this.config.windowMs / 1000)
      );

      // Enhanced rate limit headers with sliding window info
      res.set({
        'X-RateLimit-Limit': this.config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
        'X-RateLimit-Window': (this.config.windowMs / 1000).toString(),
        'X-RateLimit-Window-Start': Math.ceil(result.windowStart / 1000).toString(),
        'X-RateLimit-Requests-In-Window': result.count.toString(),
        ...(result.averageInterval && {
          'X-RateLimit-Avg-Interval': Math.round(result.averageInterval).toString()
        })
      });

      if (!result.allowed) {
        const nextAllowedTime = Math.min(...result.requestTimes) + this.config.windowMs;
        const retryAfter = Math.max(1, Math.ceil((nextAllowedTime - Date.now()) / 1000));
        
        console.log(`🚫 Sliding window rate limit exceeded for vehicle ${vehicleVin}: ${result.count}/${this.config.maxRequests}`);
        console.log(`📊 Request pattern: ${result.requestTimes.length} requests in last ${this.config.windowMs/1000}s`);
        if (result.averageInterval) {
          console.log(`⏱️ Average interval between requests: ${Math.round(result.averageInterval)}ms`);
        }
        
        res.status(429).json({
          error: this.config.message,
          rateLimitExceeded: true,
          slidingWindow: {
            currentCount: result.count,
            limit: this.config.maxRequests,
            windowMs: this.config.windowMs,
            windowStart: new Date(result.windowStart),
            resetTime: new Date(result.resetTime),
            retryAfter: retryAfter,
            requestPattern: {
              totalRequests: result.requestTimes.length,
              averageInterval: result.averageInterval ? Math.round(result.averageInterval) : null,
              requestTimes: result.requestTimes.slice(-5).map(t => new Date(t)) // Last 5 requests
            }
          }
        });
        return;
      }

      console.log(`✅ Request allowed for vehicle ${vehicleVin} (${result.count}/${this.config.maxRequests})`);
      console.log(`📈 Sliding window: ${result.requestTimes.length} requests, ${result.remaining} remaining`);
      next();
    } catch (error) {
      console.error('Redis sliding window rate limiting error, falling back to allow:', error);
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

  static async getSlidingWindowStats(vehicleVin: number, endpoint?: string): Promise<any> {
    const cache = CacheService.getInstance();
    
    if (!endpoint) {
      // Get stats for all endpoints for this vehicle
      const patterns = ['/capture', '/capture/batch', '/latest', '/alerts'];
      const stats = await Promise.all(
        patterns.map(async (ep) => {
          const key = CacheKeys.rateLimit(vehicleVin, ep);
          const status = await cache.getRateLimitStatus(key, 10, 30); // Default limits
          return {
            endpoint: ep,
            ...status
          };
        })
      );
      
      return {
        vehicleVin,
        endpointStats: stats,
        generatedAt: new Date()
      };
    } else {
      // Get stats for specific endpoint
      const key = CacheKeys.rateLimit(vehicleVin, endpoint);
      const status = await cache.getRateLimitStatus(key, 10, 30);
      
      return {
        vehicleVin,
        endpoint,
        slidingWindow: {
          ...status,
          requestPattern: status.requestTimes.length > 1 ? {
            intervals: status.requestTimes.slice(1).map((time, i) => 
              time - status.requestTimes[i]
            ),
            averageInterval: status.requestTimes.length > 1 ? 
              (status.requestTimes[status.requestTimes.length - 1] - status.requestTimes[0]) / 
              (status.requestTimes.length - 1) : null
          } : null
        },
        generatedAt: new Date()
      };
    }
  }

  static async getGlobalSlidingWindowStats(): Promise<any> {
    const cache = CacheService.getInstance();
    
    try {
      // Get all rate limit keys
      const keys = await cache.keys('ratelimit:*');
      
      const stats = await Promise.all(
        keys.map(async (key) => {
          const parts = key.split(':');
          if (parts.length >= 3) {
            const vehicleVin = parseInt(parts[1]);
            const endpoint = parts[2];
            const status = await cache.getRateLimitStatus(key, 10, 30);
            
            return {
              vehicleVin,
              endpoint,
              ...status
            };
          }
          return null;
        })
      );
      
      const validStats = stats.filter(s => s !== null);
      const summary = {
        totalActiveWindows: validStats.length,
        totalRequests: validStats.reduce((sum, s) => sum + s.count, 0),
        averageRequestsPerWindow: validStats.length > 0 ? 
          validStats.reduce((sum, s) => sum + s.count, 0) / validStats.length : 0,
        mostActiveVehicle: validStats.length > 0 ? 
          validStats.reduce((max, current) => 
            current.count > max.count ? current : max
          ) : null
      };
      
      return {
        summary,
        activeWindows: validStats,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting global sliding window stats:', error);
      return {
        error: 'Failed to get sliding window statistics',
        generatedAt: new Date()
      };
    }
  }
}
