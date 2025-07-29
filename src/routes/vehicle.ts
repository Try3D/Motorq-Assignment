import express from "express";
import { VehicleService } from "../services/vehicleService";
import { TelemetryService } from "../services/telemetryService";
import { AlertService } from "../services/alertService";
import { Vehicle } from "../types/Vehicle";

const router = express.Router();
const vehicleService = new VehicleService();
const telemetryService = new TelemetryService();
const alertService = new AlertService();

router.post("/add", async function (req: any, res: any) {
  try {
    console.log(req.body);
    const { vin, manufacturer, fleetId, registrationStatus } = req.body;

    const added = await vehicleService.addVehicle(
      fleetId,
      new Vehicle({
        vin,
        manufacturer,
        fleetId,
        registrationStatus,
        telemetryData: [],
      }),
    );

    if (!added) {
      res.json({ msg: "Could not add it for some reason" });
    }

    res.json({ msg: "Successfully added a new vehicle for fleet", fleetId });
  } catch {
    res.json({ msg: "Pass the fields properly" });
  }
});

router.get("/:vehicleVin/alerts", async function (req: any, res: any) {
  try {
    const vehicleVin = parseInt(req.params.vehicleVin);

    if (isNaN(vehicleVin)) {
      return res.status(400).json({ error: "Invalid vehicle VIN" });
    }

    const alerts = await alertService.getVehicleAlerts(vehicleVin);

    if (alerts.error) {
      return res.status(404).json(alerts);
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Failed to get vehicle alerts" });
  }
});

router.get("/", async function (req: any, res: any) {
  try {
    const vehicles = await vehicleService.getAllVehicles();
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: "Failed to get vehicles" });
  }
});

router.delete("/:vehicleId", async function (req: any, res: any) {
  try {
    const vehicleId = parseInt(req.params.vehicleId);

    if (isNaN(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const deleted = await vehicleService.deleteVehicle(vehicleId);

    if (deleted) {
      res.json({ msg: "Vehicle deleted successfully", vehicleId });
    } else {
      res.status(404).json({ error: "Vehicle not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to delete vehicle" });
  }
});

router.get("/:vehicleId/telemetry/latest", async function (req: any, res: any) {
  try {
    const vehicleId = parseInt(req.params.vehicleId);

    if (isNaN(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const telemetry = await telemetryService.getLatestTelemetry(vehicleId);

    if (telemetry.error) {
      return res.status(404).json(telemetry);
    }

    res.json(telemetry);
  } catch (error) {
    res.status(500).json({ error: "Failed to get latest telemetry" });
  }
});

router.get("/:vehicleId/telemetry", async function (req: any, res: any) {
  try {
    const vehicleId = parseInt(req.params.vehicleId);

    if (isNaN(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const telemetryHistory = await telemetryService.getTelemetryHistory(vehicleId);

    if (telemetryHistory.error) {
      return res.status(404).json(telemetryHistory);
    }

    res.json(telemetryHistory);
  } catch (error) {
    res.status(500).json({ error: "Failed to get telemetry history" });
  }
});

export default router;
