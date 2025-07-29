import express from "express";

import { MotorqService } from "./services/motorq";
import { Owner } from "./types/Owner";
import { Fleet } from "./types/Fleet";
import { Vehicle } from "./types/Vehicle";
import { Telemetry } from "./types/Telemetry";

const ms = new MotorqService({
  owners: [],
});

const app = express();

app.use(express.json());

app.post("/owner/add", function (req: any, res: any) {
  try {
    const { ownerId, name } = req.body;

    if (ms.addOwner(new Owner({ ownerId, name, fleets: [] }))) {
      res.json({ msg: "done" });
    } else {
      res.json({ msg: "Could not add it for some reason" });
    }
  } catch {
    res.json({ msg: "Pass the ownerId and name!" });
  }
});

app.post("/fleet/add", function (req: any, res: any) {
  try {
    const { fleetId, fleetType, ownerId } = req.body;

    const added = ms.addFleet(
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

app.post("/vehicle/add", function (req: any, res: any) {
  try {
    console.log(req.body);
    const { vin, manufacturer, fleetId, registrationStatus } = req.body;

    const added = ms.addVehicle(
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

app.post("/telemetry/capture", function (req, res) {
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

    const added = ms.addTelemetry(
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
      res.json({
        msg: "Could not add",
        vehicleId,
      });
    }

    res.json({
      msg: "Successfully added a new telemetry for vehicle",
      vehicleId,
    });
  } catch {
    res.json({ msg: "Pass the fields properly" });
  }
});

app.get("/data", function (req: any, res: any) {
  res.json({ owners: ms.owners });
});

export default app;
