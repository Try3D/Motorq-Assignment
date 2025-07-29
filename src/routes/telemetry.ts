import express from "express";
import { TelemetryService } from "../services/telemetryService";
import { Telemetry } from "../types/Telemetry";

const router = express.Router();
const telemetryService = new TelemetryService();

router.post("/capture", async function (req, res) {
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
      vehicleId,
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
        msg: "Could not add",
        vehicleId,
      });
    }

    return res.json({
      msg: "Successfully added telemetry for vehicle",
      vehicleId,
      note: "Alerts will be computed by background service within 30 seconds",
    });
  } catch (error) {
    console.error("Error adding telemetry:", error);
    return res.status(500).json({ msg: "Pass the fields properly" });
  }
});

router.post("/capture/batch", async function (req, res) {
  try {
    const { telemetryData } = req.body;

    if (!Array.isArray(telemetryData)) {
      return res.status(400).json({ error: "telemetryData must be an array" });
    }

    const results = [];

    for (const data of telemetryData) {
      const {
        latitude,
        longitude,
        speed,
        engineStatus,
        fuel,
        totalKm,
        vehicleId,
      } = data;

      if (Math.abs(latitude) >= 1000 || Math.abs(longitude) >= 1000) {
        results.push({
          vehicleId,
          success: false,
          error: "Latitude and longitude must be less than 1000",
        });
        continue;
      }

      if (speed >= 1000 || fuel >= 1000 || totalKm >= 1000) {
        results.push({
          vehicleId,
          success: false,
          error: "Speed, fuel, and totalKm must be less than 1000",
        });
        continue;
      }

      try {
        const added = await telemetryService.addTelemetry(
          vehicleId,
          new Telemetry({
            gps: { latitude, longitude },
            speed,
            engineStatus,
            fuel,
            totalKm,
            timeStamp: new Date(),
          }),
        );

        results.push({
          vehicleId,
          success: added,
          error: added ? null : "Could not add telemetry",
        });
      } catch (error) {
        results.push({
          vehicleId,
          success: false,
          error: "Failed to process telemetry",
        });
      }
    }

    return res.json({
      msg: "Batch telemetry processing completed",
      results,
      note: "Alerts will be computed by background service within 30 seconds",
    });
  } catch (error) {
    console.error("Error in batch telemetry:", error);
    return res.status(500).json({ error: "Failed to process batch telemetry" });
  }
});

export default router;
