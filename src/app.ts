import express from "express";
import { MotorqService } from "./services/motorq";
import { Owner } from "./types/Owner";
import { Fleet } from "./types/Fleet";
import { Vehicle } from "./types/Vehicle";
import { Telemetry } from "./types/Telemetry";

const ms = new MotorqService();

const app = express();

app.use(express.json());

app.post("/owner/add", async function (req: any, res: any) {
  try {
    const { ownerId, name } = req.body;

    if (await ms.addOwner(new Owner({ ownerId, name, fleets: [] }))) {
      res.json({ msg: "done" });
    } else {
      res.json({ msg: "Could not add it for some reason" });
    }
  } catch {
    res.json({ msg: "Pass the ownerId and name!" });
  }
});

app.post("/fleet/add", async function (req: any, res: any) {
  try {
    const { fleetId, fleetType, ownerId } = req.body;

    const added = await ms.addFleet(
      ownerId,
      new Fleet({
        fleetId,
        fleetType,
        ownerId,
        vehicles: [],
      }),
    );

    if (!added) {
      res.json({ msg: "Could not add it for some reason" });
    }

    res.json({ msg: "Successfully added a new fleet for owner", ownerId });
  } catch {
    res.json({ msg: "Pass the fields properly" });
  }
});

app.post("/vehicle/add", async function (req: any, res: any) {
  try {
    console.log(req.body);
    const { vin, manufacturer, fleetId, registrationStatus } = req.body;

    const added = await ms.addVehicle(
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

app.post("/telemetry/capture", async function (req, res) {
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

    console.log(req.body);

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

    const added = await ms.addTelemetry(
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
      msg: "Successfully added a new telemetry for vehicle",
      vehicleId,
    });
  } catch (error) {
    console.error("Error adding telemetry:", error);
    return res.status(500).json({ msg: "Pass the fields properly" });
  }
});

app.get("/data", async function (req: any, res: any) {
  const data = await ms.getAllData();
  res.json(data);
});

app.get("/fleet/:fleetId/analytics", async function (req: any, res: any) {
  try {
    const fleetId = parseInt(req.params.fleetId);

    if (isNaN(fleetId)) {
      return res.status(400).json({ error: "Invalid fleet ID" });
    }

    const analytics = await ms.getFleetAnalytics(fleetId);

    if (analytics.error) {
      return res.status(404).json(analytics);
    }

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: "Failed to get fleet analytics" });
  }
});

app.get("/fleet/:fleetId/distance/24h", async function (req: any, res: any) {
  try {
    const fleetId = parseInt(req.params.fleetId);

    if (isNaN(fleetId)) {
      return res.status(400).json({ error: "Invalid fleet ID" });
    }

    const distanceData = await ms.getFleetDistance24Hours(fleetId);

    if (distanceData.error) {
      return res.status(404).json(distanceData);
    }

    res.json(distanceData);
  } catch (error) {
    res.status(500).json({ error: "Failed to get 24h distance data" });
  }
});

app.get("/fleet/:fleetId/alerts", async function (req: any, res: any) {
  try {
    const fleetId = parseInt(req.params.fleetId);

    if (isNaN(fleetId)) {
      return res.status(400).json({ error: "Invalid fleet ID" });
    }

    const alerts = await ms.getFleetAlerts(fleetId);

    if (alerts.error) {
      return res.status(404).json(alerts);
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Failed to get fleet alerts" });
  }
});

app.post("/alert/:alertId/resolve", async function (req: any, res: any) {
  try {
    const alertId = parseInt(req.params.alertId);

    if (isNaN(alertId)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }

    const resolved = await ms.resolveAlert(alertId);

    if (resolved) {
      res.json({ msg: "Alert resolved successfully", alertId });
    } else {
      res.status(404).json({ error: "Alert not found or already resolved" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

app.get("/vehicle/:vehicleVin/alerts", async function (req: any, res: any) {
  try {
    const vehicleVin = parseInt(req.params.vehicleVin);

    if (isNaN(vehicleVin)) {
      return res.status(400).json({ error: "Invalid vehicle VIN" });
    }

    const alerts = await ms.getVehicleAlerts(vehicleVin);

    if (alerts.error) {
      return res.status(404).json(alerts);
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Failed to get vehicle alerts" });
  }
});

app.get("/vehicles", async function (req: any, res: any) {
  try {
    const vehicles = await ms.getAllVehicles();
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: "Failed to get vehicles" });
  }
});

app.get("/fleet/:fleetId/vehicles", async function (req: any, res: any) {
  try {
    const fleetId = parseInt(req.params.fleetId);

    if (isNaN(fleetId)) {
      return res.status(400).json({ error: "Invalid fleet ID" });
    }

    const vehicles = await ms.getVehiclesByFleet(fleetId);

    if (vehicles.error) {
      return res.status(404).json(vehicles);
    }

    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: "Failed to get fleet vehicles" });
  }
});

app.delete("/vehicle/:vehicleId", async function (req: any, res: any) {
  try {
    const vehicleId = parseInt(req.params.vehicleId);

    if (isNaN(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const deleted = await ms.deleteVehicle(vehicleId);

    if (deleted) {
      res.json({ msg: "Vehicle deleted successfully", vehicleId });
    } else {
      res.status(404).json({ error: "Vehicle not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to delete vehicle" });
  }
});

app.get(
  "/vehicle/:vehicleId/telemetry/latest",
  async function (req: any, res: any) {
    try {
      const vehicleId = parseInt(req.params.vehicleId);

      if (isNaN(vehicleId)) {
        return res.status(400).json({ error: "Invalid vehicle ID" });
      }

      const telemetry = await ms.getLatestTelemetry(vehicleId);

      if (telemetry.error) {
        return res.status(404).json(telemetry);
      }

      res.json(telemetry);
    } catch (error) {
      res.status(500).json({ error: "Failed to get latest telemetry" });
    }
  },
);

app.get("/vehicle/:vehicleId/telemetry", async function (req: any, res: any) {
  try {
    const vehicleId = parseInt(req.params.vehicleId);

    if (isNaN(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const telemetryHistory = await ms.getTelemetryHistory(vehicleId);

    if (telemetryHistory.error) {
      return res.status(404).json(telemetryHistory);
    }

    res.json(telemetryHistory);
  } catch (error) {
    res.status(500).json({ error: "Failed to get telemetry history" });
  }
});

app.post("/telemetry/capture/batch", async function (req, res) {
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
        const added = await ms.addTelemetry(
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
    });
  } catch (error) {
    console.error("Error in batch telemetry:", error);
    return res.status(500).json({ error: "Failed to process batch telemetry" });
  }
});

export default app;
