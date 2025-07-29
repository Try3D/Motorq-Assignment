import { createClient, RedisClientType } from 'redis';

export class CacheService {
  private static instance: CacheService;
  private client: RedisClientType | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client) return;

    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
        },
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('🔄 Connecting to Redis...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
      console.log('✅ Connected to Redis cache successfully');
    } catch (error) {
      console.warn('⚠️ Redis not available, cache disabled:', error);
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🔌 Disconnected from Redis');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;

    try {
      const data = await this.client.get(key);
      if (data) {
        console.log(`📋 Cache HIT for key: ${key}`);
        return JSON.parse(data) as T;
      }
      console.log(`💨 Cache MISS for key: ${key}`);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      console.log(`💾 Cache SET for key: ${key}, TTL: ${ttlSeconds}s`);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;

    try {
      const result = await this.client.del(key);
      console.log(`🗑️ Cache DELETE for key: ${key}, deleted: ${result}`);
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected || !this.client) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.client) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.client.del(keys);
      console.log(`🧹 Cache invalidated ${result} keys matching pattern: ${pattern}`);
      return result;
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
      return 0;
    }
  }

  // Rate limiting with Redis - Sliding Window Algorithm
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{
    allowed: boolean;
    count: number;
    resetTime: number;
  }> {
    if (!this.isConnected || !this.client) {
      return { allowed: true, count: 0, resetTime: Date.now() + windowSeconds * 1000 };
    }

    try {
      const now = Date.now();
      const windowStart = now - (windowSeconds * 1000);
      
      // Use Redis Lua script for atomic sliding window rate limiting
      const luaScript = `
        local key = KEYS[1]
        local window_start = tonumber(ARGV[1])
        local now = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local window_seconds = tonumber(ARGV[4])
        local request_id = ARGV[5]
        
        -- Remove expired entries (outside the sliding window)
        redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
        
        -- Get current count in the window
        local current_count = redis.call('ZCARD', key)
        
        -- Check if request is allowed
        if current_count < limit then
          -- Add current request to the sorted set
          redis.call('ZADD', key, now, request_id)
          -- Set expiration for the key (cleanup)
          redis.call('EXPIRE', key, window_seconds)
          return {1, current_count + 1}  -- allowed, new_count
        else
          return {0, current_count}  -- not allowed, current_count
        end
      `;
      
      const requestId = `${now}-${Math.random().toString(36).substr(2, 9)}`;
      const result = await this.client.eval(luaScript, {
        keys: [key],
        arguments: [
          windowStart.toString(),
          now.toString(), 
          limit.toString(),
          windowSeconds.toString(),
          requestId
        ]
      }) as [number, number];
      
      const [allowed, count] = result;
      
      return {
        allowed: allowed === 1,
        count: count,
        resetTime: now + (windowSeconds * 1000)
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true, count: 0, resetTime: Date.now() + windowSeconds * 1000 };
    }
  }

  // Advanced sliding window with detailed analytics
  async checkRateLimitWithAnalytics(key: string, limit: number, windowSeconds: number): Promise<{
    allowed: boolean;
    count: number;
    remaining: number;
    resetTime: number;
    windowStart: number;
    requestTimes: number[];
    averageInterval?: number;
  }> {
    if (!this.isConnected || !this.client) {
      return { 
        allowed: true, 
        count: 0, 
        remaining: limit,
        resetTime: Date.now() + windowSeconds * 1000,
        windowStart: Date.now() - windowSeconds * 1000,
        requestTimes: []
      };
    }

    try {
      const now = Date.now();
      const windowStart = now - (windowSeconds * 1000);
      
      const luaScript = `
        local key = KEYS[1]
        local window_start = tonumber(ARGV[1])
        local now = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local window_seconds = tonumber(ARGV[4])
        local request_id = ARGV[5]
        
        -- Remove expired entries
        redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
        
        -- Get current count and request times in window
        local current_count = redis.call('ZCARD', key)
        local request_times = redis.call('ZRANGEBYSCORE', key, window_start, '+inf')
        
        -- Check if request is allowed
        if current_count < limit then
          redis.call('ZADD', key, now, request_id)
          redis.call('EXPIRE', key, window_seconds * 2)  -- Extra time for cleanup
          table.insert(request_times, now)
          return {1, current_count + 1, request_times}
        else
          return {0, current_count, request_times}
        end
      `;
      
      const requestId = `${now}-${Math.random().toString(36).substr(2, 9)}`;
      const result = await this.client.eval(luaScript, {
        keys: [key],
        arguments: [
          windowStart.toString(),
          now.toString(), 
          limit.toString(),
          windowSeconds.toString(),
          requestId
        ]
      }) as [number, number, string[]];
      
      const [allowed, count, requestTimesStr] = result;
      const requestTimes = requestTimesStr.map(t => parseFloat(t)).filter(t => !isNaN(t)).sort();
      
      // Calculate average interval between requests
      let averageInterval: number | undefined;
      if (requestTimes.length > 1) {
        const intervals = [];
        for (let i = 1; i < requestTimes.length; i++) {
          intervals.push(requestTimes[i] - requestTimes[i-1]);
        }
        averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }
      
      return {
        allowed: allowed === 1,
        count: count,
        remaining: Math.max(0, limit - count),
        resetTime: now + (windowSeconds * 1000),
        windowStart: windowStart,
        requestTimes: requestTimes,
        averageInterval
      };
    } catch (error) {
      console.error('Rate limit analytics check error:', error);
      return { 
        allowed: true, 
        count: 0, 
        remaining: limit,
        resetTime: Date.now() + windowSeconds * 1000,
        windowStart: Date.now() - windowSeconds * 1000,
        requestTimes: []
      };
    }
  }

  // Get rate limit status without consuming a request
  async getRateLimitStatus(key: string, limit: number, windowSeconds: number): Promise<{
    count: number;
    remaining: number;
    resetTime: number;
    requestTimes: number[];
  }> {
    if (!this.isConnected || !this.client) {
      return { 
        count: 0, 
        remaining: limit,
        resetTime: Date.now() + windowSeconds * 1000,
        requestTimes: []
      };
    }

    try {
      const now = Date.now();
      const windowStart = now - (windowSeconds * 1000);
      
      const luaScript = `
        local key = KEYS[1]
        local window_start = tonumber(ARGV[1])
        
        -- Remove expired entries
        redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
        
        -- Get current status
        local current_count = redis.call('ZCARD', key)
        local request_times = redis.call('ZRANGEBYSCORE', key, window_start, '+inf')
        
        return {current_count, request_times}
      `;
      
      const result = await this.client.eval(luaScript, {
        keys: [key],
        arguments: [windowStart.toString()]
      }) as [number, string[]];
      
      const [count, requestTimesStr] = result;
      const requestTimes = requestTimesStr.map(t => parseFloat(t)).filter(t => !isNaN(t)).sort();
      
      return {
        count: count,
        remaining: Math.max(0, limit - count),
        resetTime: now + (windowSeconds * 1000),
        requestTimes: requestTimes
      };
    } catch (error) {
      console.error('Rate limit status check error:', error);
      return { 
        count: 0, 
        remaining: limit,
        resetTime: Date.now() + windowSeconds * 1000,
        requestTimes: []
      };
    }
  }

  async getStats(): Promise<any> {
    if (!this.isConnected || !this.client) return { connected: false };

    try {
      const info = await this.client.info('memory');
      const dbSize = await this.client.dbSize();
      
      return {
        connected: this.isConnected,
        dbSize,
        memoryInfo: info,
        timestamp: new Date()
      };
    } catch (error: any) {
      console.error('Cache stats error:', error);
      return { connected: false, error: error.message };
    }
  }
}

// Cache key generators
export class CacheKeys {
  static fleetAnalytics(fleetId: number): string {
    return `fleet:${fleetId}:analytics`;
  }

  static fleetDistance24h(fleetId: number): string {
    return `fleet:${fleetId}:distance:24h`;
  }

  static fleetAlerts(fleetId: number): string {
    return `fleet:${fleetId}:alerts`;
  }

  static vehicleLatestTelemetry(vehicleVin: number): string {
    return `vehicle:${vehicleVin}:telemetry:latest`;
  }

  static vehicleTelemetryHistory(vehicleVin: number): string {
    return `vehicle:${vehicleVin}:telemetry:history`;
  }

  static vehicleAlerts(vehicleVin: number): string {
    return `vehicle:${vehicleVin}:alerts`;
  }

  static allVehicles(): string {
    return `vehicles:all`;
  }

  static rateLimit(vehicleVin: number, endpoint: string): string {
    return `ratelimit:${vehicleVin}:${endpoint}`;
  }

  static fleetVehicles(fleetId: number): string {
    return `fleet:${fleetId}:vehicles`;
  }
}
