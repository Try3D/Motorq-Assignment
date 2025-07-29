import { CacheService, CacheKeys } from "../../src/services/cacheService";
import { createClient } from "redis";

jest.mock("redis", () => ({
  createClient: jest.fn(),
}));

describe("CacheService", () => {
  let cacheService: CacheService;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
      eval: jest.fn(),
      info: jest.fn(),
      dbSize: jest.fn(),
      on: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockRedisClient);
    cacheService = CacheService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("connect", () => {
    it("should connect to Redis successfully", async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);

      await cacheService.connect();

      expect(createClient).toHaveBeenCalledWith({
        url: "redis://localhost:6379",
        socket: { connectTimeout: 5000 },
      });
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith("ready", expect.any(Function));
    });

    it("should handle connection errors gracefully", async () => {
      mockRedisClient.connect.mockRejectedValue(new Error("Connection failed"));

      await cacheService.connect();

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it("should not reconnect if already connected", async () => {
      (cacheService as any).isConnected = true;
      (cacheService as any).client = mockRedisClient;

      await cacheService.connect();

      expect(mockRedisClient.connect).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
      (cacheService as any).client = mockRedisClient;
    });

    it("should return parsed data on cache hit", async () => {
      const testData = { id: 1, name: "test" };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get("test-key");

      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith("test-key");
    });

    it("should return null on cache miss", async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.get("test-key");

      expect(result).toBeNull();
    });

    it("should return null when not connected", async () => {
      (cacheService as any).isConnected = false;

      const result = await cacheService.get("test-key");

      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedisClient.get.mockRejectedValue(new Error("Redis error"));

      const result = await cacheService.get("test-key");

      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
      (cacheService as any).client = mockRedisClient;
    });

    it("should set data with TTL successfully", async () => {
      const testData = { id: 1, name: "test" };
      mockRedisClient.setEx.mockResolvedValue("OK");

      const result = await cacheService.set("test-key", testData, 300);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "test-key",
        300,
        JSON.stringify(testData)
      );
    });

    it("should use default TTL when not specified", async () => {
      const testData = { id: 1, name: "test" };
      mockRedisClient.setEx.mockResolvedValue("OK");

      await cacheService.set("test-key", testData);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "test-key",
        300,
        JSON.stringify(testData)
      );
    });

    it("should return false when not connected", async () => {
      (cacheService as any).isConnected = false;

      const result = await cacheService.set("test-key", { data: "test" });

      expect(result).toBe(false);
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });
  });

  describe("del", () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
      (cacheService as any).client = mockRedisClient;
    });

    it("should delete key successfully", async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await cacheService.del("test-key");

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith("test-key");
    });

    it("should return false when key not found", async () => {
      mockRedisClient.del.mockResolvedValue(0);

      const result = await cacheService.del("test-key");

      expect(result).toBe(false);
    });
  });

  describe("checkRateLimit", () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
      (cacheService as any).client = mockRedisClient;
    });

    it("should allow request within rate limit", async () => {
      mockRedisClient.eval.mockResolvedValue([1, 3]);

      const result = await cacheService.checkRateLimit("test-key", 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(3);
      expect(mockRedisClient.eval).toHaveBeenCalled();
    });

    it("should deny request when rate limit exceeded", async () => {
      mockRedisClient.eval.mockResolvedValue([0, 10]);

      const result = await cacheService.checkRateLimit("test-key", 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.count).toBe(10);
    });

    it("should allow request when not connected (fallback)", async () => {
      (cacheService as any).isConnected = false;

      const result = await cacheService.checkRateLimit("test-key", 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(0);
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedisClient.eval.mockRejectedValue(new Error("Redis error"));

      const result = await cacheService.checkRateLimit("test-key", 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe("checkRateLimitWithAnalytics", () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
      (cacheService as any).client = mockRedisClient;
    });

    it("should return analytics with rate limit check", async () => {
      const requestTimes = ["1000", "2000", "3000"];
      mockRedisClient.eval.mockResolvedValue([1, 3, requestTimes]);

      const result = await cacheService.checkRateLimitWithAnalytics("test-key", 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(3);
      expect(result.remaining).toBe(7);
      expect(result.requestTimes).toEqual([1000, 2000, 3000]);
      expect(result.averageInterval).toBeDefined();
    });

    it("should calculate average interval correctly", async () => {
      const requestTimes = ["1000", "2000", "4000"];
      mockRedisClient.eval.mockResolvedValue([1, 3, requestTimes]);

      const result = await cacheService.checkRateLimitWithAnalytics("test-key", 10, 60);

      expect(result.averageInterval).toBe(1500); // (1000 + 2000) / 2
    });
  });

  describe("invalidatePattern", () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
      (cacheService as any).client = mockRedisClient;
    });

    it("should invalidate keys matching pattern", async () => {
      mockRedisClient.keys.mockResolvedValue(["key1", "key2", "key3"]);
      mockRedisClient.del.mockResolvedValue(3);

      const result = await cacheService.invalidatePattern("test:*");

      expect(result).toBe(3);
      expect(mockRedisClient.keys).toHaveBeenCalledWith("test:*");
      expect(mockRedisClient.del).toHaveBeenCalledWith(["key1", "key2", "key3"]);
    });

    it("should return 0 when no keys match pattern", async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await cacheService.invalidatePattern("test:*");

      expect(result).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe("getStats", () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
      (cacheService as any).client = mockRedisClient;
    });

    it("should return Redis stats", async () => {
      mockRedisClient.info.mockResolvedValue("memory info");
      mockRedisClient.dbSize.mockResolvedValue(100);

      const result = await cacheService.getStats();

      expect(result.connected).toBe(true);
      expect(result.dbSize).toBe(100);
      expect(result.memoryInfo).toBe("memory info");
    });

    it("should return disconnected status when not connected", async () => {
      (cacheService as any).isConnected = false;

      const result = await cacheService.getStats();

      expect(result.connected).toBe(false);
    });
  });
});

describe("CacheKeys", () => {
  it("should generate correct fleet analytics key", () => {
    expect(CacheKeys.fleetAnalytics(123)).toBe("fleet:123:analytics");
  });

  it("should generate correct fleet distance key", () => {
    expect(CacheKeys.fleetDistance24h(123)).toBe("fleet:123:distance:24h");
  });

  it("should generate correct vehicle telemetry key", () => {
    expect(CacheKeys.vehicleLatestTelemetry(456)).toBe("vehicle:456:telemetry:latest");
  });

  it("should generate correct rate limit key", () => {
    expect(CacheKeys.rateLimit(789, "/telemetry")).toBe("ratelimit:789:/telemetry");
  });

  it("should generate correct all vehicles key", () => {
    expect(CacheKeys.allVehicles()).toBe("vehicles:all");
  });
});