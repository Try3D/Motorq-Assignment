import { Request, Response, NextFunction } from "express";
import { RateLimiter, RateLimitMonitor } from "../../src/middleware/rateLimiter";
import { CacheService, CacheKeys } from "../../src/services/cacheService";
import { AuthenticatedRequest } from "../../src/middleware/vehicleAuth";
import pool from "../../src/database/connection";

jest.mock("../../src/services/cacheService");
jest.mock("../../src/database/connection");

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockCache = {
      checkRateLimitWithAnalytics: jest.fn(),
      getInstance: jest.fn(),
    } as any;
    (CacheService.getInstance as jest.Mock).mockReturnValue(mockCache);

    rateLimiter = new RateLimiter({
      windowMs: 10000,
      maxRequests: 5,
      message: "Rate limit exceeded",
    });

    mockReq = {
      vehicle: { 
        vin: 123456, 
        manufacturer: "Ford", 
        fleetId: 1, 
        registrationStatus: "Active" 
      },
      route: { path: "/telemetry" },
      path: "/telemetry",
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("middleware", () => {
    it("should allow request when within rate limit", async () => {
      mockCache.checkRateLimitWithAnalytics.mockResolvedValue({
        allowed: true,
        count: 3,
        remaining: 2,
        resetTime: Date.now() + 10000,
        windowStart: Date.now() - 10000,
        requestTimes: [Date.now() - 5000, Date.now() - 3000, Date.now()],
        averageInterval: 2500,
      });

      await rateLimiter.middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).toHaveBeenCalledWith({
        "X-RateLimit-Limit": "5",
        "X-RateLimit-Remaining": "2",
        "X-RateLimit-Reset": expect.any(String),
        "X-RateLimit-Window": "10",
        "X-RateLimit-Window-Start": expect.any(String),
        "X-RateLimit-Requests-In-Window": "3",
        "X-RateLimit-Avg-Interval": "2500",
      });
    });

    it("should reject request when rate limit exceeded", async () => {
      const requestTimes = [
        Date.now() - 9000,
        Date.now() - 7000,
        Date.now() - 5000,
        Date.now() - 3000,
        Date.now() - 1000,
      ];

      mockCache.checkRateLimitWithAnalytics.mockResolvedValue({
        allowed: false,
        count: 5,
        remaining: 0,
        resetTime: Date.now() + 10000,
        windowStart: Date.now() - 10000,
        requestTimes,
        averageInterval: 2000,
      });

      await rateLimiter.middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Rate limit exceeded",
        rateLimitExceeded: true,
        slidingWindow: expect.objectContaining({
          currentCount: 5,
          limit: 5,
          windowMs: 10000,
          retryAfter: expect.any(Number),
        }),
      });
    });

    it("should return 401 when vehicle not authenticated", async () => {
      mockReq.vehicle = undefined;

      await rateLimiter.middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Vehicle not authenticated",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should fall back to allow on cache error", async () => {
      mockCache.checkRateLimitWithAnalytics.mockRejectedValue(
        new Error("Cache error")
      );

      await rateLimiter.middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should use path when route is not available", async () => {
      mockReq.route = undefined;
      mockCache.checkRateLimitWithAnalytics.mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 4,
        resetTime: Date.now() + 10000,
        windowStart: Date.now() - 10000,
        requestTimes: [Date.now()],
      });

      await rateLimiter.middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockCache.checkRateLimitWithAnalytics).toHaveBeenCalledWith(
        CacheKeys.rateLimit(123456, "/telemetry"),
        5,
        10
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("static factory methods", () => {
    it("should create telemetry limiter with correct config", () => {
      const limiter = RateLimiter.createTelemetryLimiter();
      expect(limiter).toBeInstanceOf(RateLimiter);
      expect((limiter as any).config.windowMs).toBe(10000);
      expect((limiter as any).config.maxRequests).toBe(5);
    });

    it("should create general limiter with correct config", () => {
      const limiter = RateLimiter.createGeneralLimiter();
      expect(limiter).toBeInstanceOf(RateLimiter);
      expect((limiter as any).config.windowMs).toBe(30000);
      expect((limiter as any).config.maxRequests).toBe(10);
    });

    it("should create batch limiter with correct config", () => {
      const limiter = RateLimiter.createBatchLimiter();
      expect(limiter).toBeInstanceOf(RateLimiter);
      expect((limiter as any).config.windowMs).toBe(60000);
      expect((limiter as any).config.maxRequests).toBe(2);
    });
  });
});

describe("RateLimitMonitor", () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getVehicleRateStats", () => {
    it("should return vehicle rate statistics", async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({
          rows: [
            {
              requests_last_hour: "10",
              requests_last_day: "50",
              first_request: new Date("2023-01-01"),
              last_request: new Date("2023-01-02"),
              unique_endpoints: "3",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { endpoint: "/telemetry", request_count: "30" },
            { endpoint: "/alerts", request_count: "20" },
          ],
        });

      const result = await RateLimitMonitor.getVehicleRateStats(123456);

      expect(result.vehicleVin).toBe(123456);
      expect(result.requestsLastHour).toBe(10);
      expect(result.requestsLastDay).toBe(50);
      expect(result.uniqueEndpoints).toBe(3);
      expect(result.endpointBreakdown).toHaveLength(2);
    });

    it("should handle missing rate limiting table", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      const result = await RateLimitMonitor.getVehicleRateStats(123456);

      expect(result.error).toBe("Rate limiting table not initialized");
      expect(result.requestsLastHour).toBe(0);
    });
  });

  describe("getTopRequesters", () => {
    it("should return top requesting vehicles", async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({
          rows: [
            {
              vehicle_vin: 123456,
              manufacturer: "Ford",
              fleet_id: 1,
              requests_last_hour: "25",
              last_request: new Date(),
            },
            {
              vehicle_vin: 789012,
              manufacturer: "Toyota",
              fleet_id: 2,
              requests_last_hour: "15",
              last_request: new Date(),
            },
          ],
        });

      const result = await RateLimitMonitor.getTopRequesters(10);

      expect(result.topRequesters).toHaveLength(2);
      expect(result.topRequesters[0].vehicle_vin).toBe(123456);
      expect(result.timeframe).toBe("1 hour");
    });

    it("should handle missing table gracefully", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      const result = await RateLimitMonitor.getTopRequesters();

      expect(result.topRequesters).toEqual([]);
      expect(result.error).toBe("Rate limiting table not initialized");
    });
  });

  describe("getSlidingWindowStats", () => {
    let mockCache: jest.Mocked<CacheService>;

    beforeEach(() => {
      mockCache = {
        getRateLimitStatus: jest.fn(),
        keys: jest.fn(),
      } as any;
      (CacheService.getInstance as jest.Mock).mockReturnValue(mockCache);
    });

    it("should return stats for all endpoints when endpoint not specified", async () => {
      mockCache.getRateLimitStatus.mockResolvedValue({
        count: 5,
        remaining: 5,
        resetTime: Date.now() + 30000,
        requestTimes: [Date.now() - 10000, Date.now()],
      });

      const result = await RateLimitMonitor.getSlidingWindowStats(123456);

      expect(result.vehicleVin).toBe(123456);
      expect(result.endpointStats).toHaveLength(4);
      expect(mockCache.getRateLimitStatus).toHaveBeenCalledTimes(4);
    });

    it("should return stats for specific endpoint", async () => {
      const requestTimes = [Date.now() - 10000, Date.now() - 5000, Date.now()];
      mockCache.getRateLimitStatus.mockResolvedValue({
        count: 3,
        remaining: 7,
        resetTime: Date.now() + 30000,
        requestTimes,
      });

      const result = await RateLimitMonitor.getSlidingWindowStats(
        123456,
        "/telemetry"
      );

      expect(result.vehicleVin).toBe(123456);
      expect(result.endpoint).toBe("/telemetry");
      expect(result.slidingWindow.count).toBe(3);
      expect(result.slidingWindow.requestPattern).toBeDefined();
    });

    it("should handle single request correctly", async () => {
      mockCache.getRateLimitStatus.mockResolvedValue({
        count: 1,
        remaining: 9,
        resetTime: Date.now() + 30000,
        requestTimes: [Date.now()],
      });

      const result = await RateLimitMonitor.getSlidingWindowStats(
        123456,
        "/telemetry"
      );

      expect(result.slidingWindow.requestPattern).toBeNull();
    });
  });

  describe("getGlobalSlidingWindowStats", () => {
    let mockCache: jest.Mocked<CacheService>;

    beforeEach(() => {
      mockCache = {
        keys: jest.fn(),
        getRateLimitStatus: jest.fn(),
      } as any;
      (CacheService.getInstance as jest.Mock).mockReturnValue(mockCache);
    });

    it("should return global sliding window statistics", async () => {
      mockCache.keys.mockResolvedValue([
        "ratelimit:123456:/telemetry",
        "ratelimit:789012:/alerts",
      ]);

      mockCache.getRateLimitStatus
        .mockResolvedValueOnce({
          count: 5,
          remaining: 5,
          resetTime: Date.now() + 30000,
          requestTimes: [Date.now()],
        })
        .mockResolvedValueOnce({
          count: 3,
          remaining: 7,
          resetTime: Date.now() + 30000,
          requestTimes: [Date.now()],
        });

      const result = await RateLimitMonitor.getGlobalSlidingWindowStats();

      expect(result.summary.totalActiveWindows).toBe(2);
      expect(result.summary.totalRequests).toBe(8);
      expect(result.summary.averageRequestsPerWindow).toBe(4);
      expect(result.activeWindows).toHaveLength(2);
    });

    it("should handle empty keys gracefully", async () => {
      mockCache.keys.mockResolvedValue([]);

      const result = await RateLimitMonitor.getGlobalSlidingWindowStats();

      expect(result.summary.totalActiveWindows).toBe(0);
      expect(result.activeWindows).toEqual([]);
    });

    it("should handle cache errors", async () => {
      mockCache.keys.mockRejectedValue(new Error("Cache error"));

      const result = await RateLimitMonitor.getGlobalSlidingWindowStats();

      expect(result.error).toBe("Failed to get sliding window statistics");
    });
  });
});