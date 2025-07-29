import express from "express";
import { TelemetryService } from "../services/telemetryService";
import {
  VehicleAuthService,
  AuthenticatedRequest,
} from "../middleware/vehicleAuth";
import { RateLimiter } from "../middleware/rateLimiter";
import { Telemetry } from "../types/Telemetry";

const router = express.Router();
const telemetryService = new TelemetryService();

const telemetryRateLimit = RateLimiter.createTelemetryLimiter();
const batchRateLimit = RateLimiter.createBatchLimiter();

router.use(VehicleAuthService.authenticateVehicle);

router.post(
  "/capture",
  telemetryRateLimit.middleware,
  async function (req: AuthenticatedRequest, res: any) {
    try {
      const {
        latitude,
        longitude,
        speed,
        engineStatus,
        fuel,
        totalKm,
        vehicleId,
      } = req.body;

      if (vehicleId && req.vehicle && vehicleId !== req.vehicle.vin) {
        return res.status(403).json({
          error: "Vehicle ID in request does not match authenticated vehicle",
        });
      }

      const actualVehicleId = vehicleId || req.vehicle?.vin;

      if (!actualVehicleId) {
        return res.status(400).json({
          error: "Vehicle ID is required",
        });
      }

      if (Math.abs(latitude) >= 1000 || Math.abs(longitude) >= 1000) {
        return res.status(400).json({
          error: "Latitude and longitude must be less than 1000",
        });
      }

      if (speed >= 1000 || fuel >= 1000 || totalKm >= 1000) {
        return res.status(400).json({
          error: "Speed, fuel, and totalKm must be less than 1000",
        });
      }

      const added = await telemetryService.addTelemetry(
        actualVehicleId,
        new Telemetry({
          gps: { latitude, longitude },
          speed,
          engineStatus,
          fuel,
          totalKm,
          timeStamp: new Date(),
        }),
      );

      if (!added) {
        return res.json({
          msg: "Could not add telemetry - possible duplicate or error",
          vehicleId: actualVehicleId,
        });
      }

      return res.json({
        msg: "Successfully added telemetry for vehicle",
        vehicleId: actualVehicleId,
        authenticatedAs: req.vehicle?.vin,
        timestamp: new Date(),
        note: "Alerts will be computed by background service within 30 seconds",
      });
    } catch (error) {
      console.error("Error adding telemetry:", error);
      return res.status(500).json({ msg: "Pass the fields properly" });
    }
  },
);

router.post(
  "/capture/batch",
  batchRateLimit.middleware,
  async function (req: AuthenticatedRequest, res: any) {
    try {
      const { telemetryData } = req.body;

      if (!Array.isArray(telemetryData)) {
        return res
          .status(400)
          .json({ error: "telemetryData must be an array" });
      }

      if (telemetryData.length > 50) {
        return res.status(400).json({
          error:
            "Batch size too large. Maximum 50 telemetry records per batch.",
        });
      }

      const results = [];
      const authenticatedVin = req.vehicle?.vin;
      let duplicatesSkipped = 0;

      for (const data of telemetryData) {
        const {
          latitude,
          longitude,
          speed,
          engineStatus,
          fuel,
          totalKm,
          vehicleId,
          timestamp,
        } = data;

        const actualVehicleId = vehicleId || authenticatedVin;

        if (actualVehicleId !== authenticatedVin) {
          results.push({
            vehicleId: vehicleId || "unknown",
            success: false,
            error: "Vehicle ID does not match authenticated vehicle",
          });
          continue;
        }

        if (Math.abs(latitude) >= 1000 || Math.abs(longitude) >= 1000) {
          results.push({
            vehicleId: actualVehicleId,
            success: false,
            error: "Latitude and longitude must be less than 1000",
          });
          continue;
        }

        if (speed >= 1000 || fuel >= 1000 || totalKm >= 1000) {
          results.push({
            vehicleId: actualVehicleId,
            success: false,
            error: "Speed, fuel, and totalKm must be less than 1000",
          });
          continue;
        }

        try {
          const telemetryTimestamp = timestamp
            ? new Date(timestamp)
            : new Date();

          const added = await telemetryService.addTelemetry(
            actualVehicleId,
            new Telemetry({
              gps: { latitude, longitude },
              speed,
              engineStatus,
              fuel,
              totalKm,
              timeStamp: telemetryTimestamp,
            }),
          );

          if (added) {
            results.push({
              vehicleId: actualVehicleId,
              success: true,
              timestamp: telemetryTimestamp,
              error: null,
            });
          } else {
            duplicatesSkipped++;
            results.push({
              vehicleId: actualVehicleId,
              success: true,
              skipped: true,
              error: "Duplicate timestamp - telemetry skipped",
            });
          }
        } catch (error) {
          results.push({
            vehicleId: actualVehicleId,
            success: false,
            error: "Failed to process telemetry",
          });
        }
      }

      return res.json({
        msg: "Batch telemetry processing completed",
        authenticatedAs: authenticatedVin,
        batchSize: telemetryData.length,
        successfulCount: results.filter((r) => r.success && !r.skipped).length,
        duplicatesSkipped,
        results,
        note: "Alerts will be computed by background service within 30 seconds",
      });
    } catch (error) {
      console.error("Error in batch telemetry:", error);
      return res
        .status(500)
        .json({ error: "Failed to process batch telemetry" });
    }
  },
);

export default router;
