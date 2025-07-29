import express from "express";
import { MotorqService } from "./services/motorq";

// Import route modules
import ownerRoutes from "./routes/owner";
import fleetRoutes from "./routes/fleet";
import vehicleRoutes from "./routes/vehicle";
import telemetryRoutes from "./routes/telemetry";
import alertRoutes from "./routes/alert";

const app = express();
const ms = new MotorqService();

app.use(express.json());

// Use route modules
app.use("/owner", ownerRoutes);
app.use("/fleet", fleetRoutes);
app.use("/vehicle", vehicleRoutes);
app.use("/telemetry", telemetryRoutes);
app.use("/alert", alertRoutes);

// Keep the main data endpoint in app.ts
app.get("/data", async function (req: any, res: any) {
  const data = await ms.getAllData();
  res.json(data);
});

export default app;
