import express from "express";
import { FleetService } from "../services/fleetService";
import { Fleet } from "../types/Fleet";

const router = express.Router();
const fleetService = new FleetService();

router.post("/add", async function (req: any, res: any) {
  try {
    const { fleetId, fleetType, ownerId } = req.body;

    const added = await fleetService.addFleet(
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

router.get("/:fleetId/analytics", async function (req: any, res: any) {
  try {
    const fleetId = parseInt(req.params.fleetId);

    if (isNaN(fleetId)) {
      return res.status(400).json({ error: "Invalid fleet ID" });
    }

    const analytics = await fleetService.getFleetAnalytics(fleetId);

    if (analytics.error) {
      return res.status(404).json(analytics);
    }

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: "Failed to get fleet analytics" });
  }
});

router.get("/:fleetId/distance/24h", async function (req: any, res: any) {
  try {
    const fleetId = parseInt(req.params.fleetId);

    if (isNaN(fleetId)) {
      return res.status(400).json({ error: "Invalid fleet ID" });
    }

    const distanceData = await fleetService.getFleetDistance24Hours(fleetId);

    if (distanceData.error) {
      return res.status(404).json(distanceData);
    }

    res.json(distanceData);
  } catch (error) {
    res.status(500).json({ error: "Failed to get 24h distance data" });
  }
});

router.get("/:fleetId/alerts", async function (req: any, res: any) {
  try {
    const fleetId = parseInt(req.params.fleetId);

    if (isNaN(fleetId)) {
      return res.status(400).json({ error: "Invalid fleet ID" });
    }

    const alerts = await fleetService.getFleetAlerts(fleetId);

    if (alerts.error) {
      return res.status(404).json(alerts);
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Failed to get fleet alerts" });
  }
});

router.get("/:fleetId/vehicles", async function (req: any, res: any) {
  try {
    const fleetId = parseInt(req.params.fleetId);

    if (isNaN(fleetId)) {
      return res.status(400).json({ error: "Invalid fleet ID" });
    }

    const vehicles = await fleetService.getVehiclesByFleet(fleetId);

    if (vehicles.error) {
      return res.status(404).json(vehicles);
    }

    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: "Failed to get fleet vehicles" });
  }
});

export default router;
