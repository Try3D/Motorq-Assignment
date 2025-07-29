import { TelemetryService } from "../../src/services/telemetryService";
import { MotorqService } from "../../src/services/motorq";
import { Telemetry } from "../../src/types/Telemetry";

jest.mock("../../src/services/motorq");

describe("TelemetryService", () => {
  let telemetryService: TelemetryService;
  let mockMotorqService: jest.Mocked<MotorqService>;

  beforeEach(() => {
    mockMotorqService = {
      addTelemetry: jest.fn(),
      getLatestTelemetry: jest.fn(),
      getTelemetryHistory: jest.fn(),
    } as any;

    (MotorqService as jest.MockedClass<typeof MotorqService>).mockImplementation(
      () => mockMotorqService
    );

    telemetryService = new TelemetryService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("addTelemetry", () => {
    it("should successfully add telemetry", async () => {
      const telemetry: Telemetry = {
        gps: { latitude: 40.7128, longitude: -74.0060 },
        speed: 60,
        engineStatus: "On",
        fuel: 75,
        totalKm: 1000,
        timeStamp: new Date(),
      };

      mockMotorqService.addTelemetry.mockResolvedValue(true);

      const result = await telemetryService.addTelemetry(123456, telemetry);

      expect(result).toBe(true);
      expect(mockMotorqService.addTelemetry).toHaveBeenCalledWith(123456, telemetry);
    });

    it("should return false when MotorqService fails", async () => {
      const telemetry: Telemetry = {
        gps: { latitude: 40.7128, longitude: -74.0060 },
        speed: 60,
        engineStatus: "On",
        fuel: 75,
        totalKm: 1000,
        timeStamp: new Date(),
      };

      mockMotorqService.addTelemetry.mockResolvedValue(false);

      const result = await telemetryService.addTelemetry(123456, telemetry);

      expect(result).toBe(false);
      expect(mockMotorqService.addTelemetry).toHaveBeenCalledWith(123456, telemetry);
    });

    it("should handle errors from MotorqService", async () => {
      const telemetry: Telemetry = {
        gps: { latitude: 40.7128, longitude: -74.0060 },
        speed: 60,
        engineStatus: "On",
        fuel: 75,
        totalKm: 1000,
        timeStamp: new Date(),
      };

      mockMotorqService.addTelemetry.mockRejectedValue(new Error("Database error"));

      await expect(telemetryService.addTelemetry(123456, telemetry)).rejects.toThrow("Database error");
    });
  });

  describe("getLatestTelemetry", () => {
    it("should return latest telemetry data", async () => {
      const expectedData = {
        vehicleId: 123456,
        telemetry: {
          gps: { latitude: 40.7128, longitude: -74.0060 },
          speed: 60,
          engineStatus: "On",
          fuel: 75,
          totalKm: 1000,
          timeStamp: new Date(),
        },
        fromCache: false,
      };

      mockMotorqService.getLatestTelemetry.mockResolvedValue(expectedData);

      const result = await telemetryService.getLatestTelemetry(123456);

      expect(result).toEqual(expectedData);
      expect(mockMotorqService.getLatestTelemetry).toHaveBeenCalledWith(123456);
    });

    it("should return error when vehicle not found", async () => {
      const errorResponse = { error: "Vehicle not found" };
      mockMotorqService.getLatestTelemetry.mockResolvedValue(errorResponse);

      const result = await telemetryService.getLatestTelemetry(999999);

      expect(result).toEqual(errorResponse);
    });

    it("should handle MotorqService errors", async () => {
      mockMotorqService.getLatestTelemetry.mockRejectedValue(new Error("Service error"));

      await expect(telemetryService.getLatestTelemetry(123456)).rejects.toThrow("Service error");
    });
  });

  describe("getTelemetryHistory", () => {
    it("should return telemetry history", async () => {
      const expectedHistory = {
        vehicleId: 123456,
        telemetryHistory: [
          {
            gps: { latitude: 40.7128, longitude: -74.0060 },
            speed: 60,
            engineStatus: "On",
            fuel: 75,
            totalKm: 1000,
            timeStamp: new Date(),
          },
          {
            gps: { latitude: 40.7580, longitude: -73.9855 },
            speed: 65,
            engineStatus: "On",
            fuel: 70,
            totalKm: 1010,
            timeStamp: new Date(),
          },
        ],
        totalRecords: 2,
      };

      mockMotorqService.getTelemetryHistory.mockResolvedValue(expectedHistory);

      const result = await telemetryService.getTelemetryHistory(123456);

      expect(result).toEqual(expectedHistory);
      expect(mockMotorqService.getTelemetryHistory).toHaveBeenCalledWith(123456);
    });

    it("should return error when vehicle not found", async () => {
      const errorResponse = { error: "Vehicle not found" };
      mockMotorqService.getTelemetryHistory.mockResolvedValue(errorResponse);

      const result = await telemetryService.getTelemetryHistory(999999);

      expect(result).toEqual(errorResponse);
    });

    it("should handle empty history", async () => {
      const emptyHistory = {
        vehicleId: 123456,
        telemetryHistory: [],
        totalRecords: 0,
      };

      mockMotorqService.getTelemetryHistory.mockResolvedValue(emptyHistory);

      const result = await telemetryService.getTelemetryHistory(123456);

      expect(result).toEqual(emptyHistory);
      expect(result.telemetryHistory).toHaveLength(0);
    });

    it("should handle MotorqService errors", async () => {
      mockMotorqService.getTelemetryHistory.mockRejectedValue(new Error("Database connection failed"));

      await expect(telemetryService.getTelemetryHistory(123456)).rejects.toThrow("Database connection failed");
    });
  });

  describe("integration", () => {
    it("should delegate all calls to MotorqService", async () => {
      const telemetry: Telemetry = {
        gps: { latitude: 40.7128, longitude: -74.0060 },
        speed: 60,
        engineStatus: "On",
        fuel: 75,
        totalKm: 1000,
        timeStamp: new Date(),
      };

      mockMotorqService.addTelemetry.mockResolvedValue(true);
      mockMotorqService.getLatestTelemetry.mockResolvedValue({ vehicleId: 123456 });
      mockMotorqService.getTelemetryHistory.mockResolvedValue({ vehicleId: 123456, telemetryHistory: [] });

      await telemetryService.addTelemetry(123456, telemetry);
      await telemetryService.getLatestTelemetry(123456);
      await telemetryService.getTelemetryHistory(123456);

      expect(mockMotorqService.addTelemetry).toHaveBeenCalledWith(123456, telemetry);
      expect(mockMotorqService.getLatestTelemetry).toHaveBeenCalledWith(123456);
      expect(mockMotorqService.getTelemetryHistory).toHaveBeenCalledWith(123456);
    });
  });
});