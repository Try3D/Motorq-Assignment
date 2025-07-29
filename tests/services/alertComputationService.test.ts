import { AlertComputationService } from "../../src/services/alertComputationService";
import { Alert } from "../../src/types/Alert";
import pool from "../../src/database/connection";

jest.mock("../../src/database/connection");
jest.mock("../../src/types/Alert");

describe("AlertComputationService", () => {
  let alertService: AlertComputationService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
    alertService = new AlertComputationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("computeAndStoreAlerts", () => {

    it("should create critical speed alert for speeds over 100", async () => {
      const vehicleData = [
        {
          vin: 123456,
          fleet_id: 1,
          speed: "110",
          fuel: "50",
          engine_status: "On",
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: vehicleData })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: 0 });

      (Alert as jest.MockedClass<typeof Alert>).mockImplementation((data) => ({
        ...data,
      } as any));

      await alertService.computeAndStoreAlerts();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO alerts"),
        expect.arrayContaining([123456, "Speed Violation", "Critical"])
      );
    });

    it("should create low fuel alerts", async () => {
      const vehicleData = [
        {
          vin: 123456,
          fleet_id: 1,
          speed: "60",
          fuel: "10",
          engine_status: "On",
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: vehicleData })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: 0 });

      (Alert as jest.MockedClass<typeof Alert>).mockImplementation((data) => ({
        ...data,
      } as any));

      await alertService.computeAndStoreAlerts();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO alerts"),
        expect.arrayContaining([123456, "Low Fuel", "Warning"])
      );
    });

    it("should create critical fuel alert for fuel below 5%", async () => {
      const vehicleData = [
        {
          vin: 123456,
          fleet_id: 1,
          speed: "60",
          fuel: "3",
          engine_status: "On",
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: vehicleData })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: 0 });

      (Alert as jest.MockedClass<typeof Alert>).mockImplementation((data) => ({
        ...data,
      } as any));

      await alertService.computeAndStoreAlerts();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO alerts"),
        expect.arrayContaining([123456, "Low Fuel", "Critical"])
      );
    });

    it("should create engine status alerts for off engine with movement", async () => {
      const vehicleData = [
        {
          vin: 123456,
          fleet_id: 1,
          speed: "30",
          fuel: "50",
          engine_status: "Off",
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: vehicleData })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: 0 });

      (Alert as jest.MockedClass<typeof Alert>).mockImplementation((data) => ({
        ...data,
      } as any));

      await alertService.computeAndStoreAlerts();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO alerts"),
        expect.arrayContaining([123456, "Engine Status", "Warning"])
      );
    });

    it("should not create duplicate alerts within time window", async () => {
      const vehicleData = [
        {
          vin: 123456,
          fleet_id: 1,
          speed: "90",
          fuel: "50",
          engine_status: "On",
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: vehicleData })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await alertService.computeAndStoreAlerts();

      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO alerts"),
        expect.any(Array)
      );
    });

    it("should handle no vehicles with recent telemetry", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await alertService.computeAndStoreAlerts();

      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockClient.query.mockRejectedValue(new Error("Database connection failed"));

      await alertService.computeAndStoreAlerts();

      expect(mockClient.release).toHaveBeenCalled();
    });

  });

  describe("autoResolveOldAlerts", () => {

    it("should handle errors in auto-resolve gracefully", async () => {
      mockClient.query.mockRejectedValue(new Error("Query failed"));

      const autoResolveMethod = (alertService as any).autoResolveOldAlerts;
      await autoResolveMethod.call(alertService, mockClient);

      expect(mockClient.query).toHaveBeenCalled();
    });
  });
});