import express from "express";
import { MotorqService } from "./services/motorq";
import { BackgroundJobService } from "./services/backgroundJobService";

// Import route modules
import ownerRoutes from "./routes/owner";
import fleetRoutes from "./routes/fleet";
import vehicleRoutes from "./routes/vehicle";
import telemetryRoutes from "./routes/telemetry";
import alertRoutes from "./routes/alert";
import adminRoutes from "./routes/admin";

const app = express();
const ms = new MotorqService();

// Initialize and start background job service
const backgroundJobService = new BackgroundJobService();
backgroundJobService.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, stopping background jobs...');
  backgroundJobService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, stopping background jobs...');
  backgroundJobService.stop();
  process.exit(0);
});

app.use(express.json());

// Use route modules
app.use("/owner", ownerRoutes);
app.use("/fleet", fleetRoutes);
app.use("/vehicle", vehicleRoutes);
app.use("/telemetry", telemetryRoutes);
app.use("/alert", alertRoutes);
app.use("/admin", adminRoutes);

// Keep the main data endpoint in app.ts
app.get("/data", async function (req: any, res: any) {
  const data = await ms.getAllData();
  res.json(data);
});

// Add status endpoint to check background job service
app.get("/status", async function (req: any, res: any) {
  const jobStatus = backgroundJobService.getStatus();
  res.json({
    status: "operational",
    backgroundJobs: {
      alertComputation: jobStatus,
    },
    timestamp: new Date(),
  });
});

export default app;
