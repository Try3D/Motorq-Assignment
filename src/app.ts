import express from "express";
import { MotorqService } from "./services/motorq";
import { BackgroundJobService } from "./services/backgroundJobService";
import { CacheService } from "./services/cacheService";

// Import route modules
import ownerRoutes from "./routes/owner";
import fleetRoutes from "./routes/fleet";
import vehicleRoutes from "./routes/vehicle";
import telemetryRoutes from "./routes/telemetry";
import alertRoutes from "./routes/alert";
import adminRoutes from "./routes/admin";

const app = express();
const ms = new MotorqService();

// Initialize Redis cache
const cache = CacheService.getInstance();
cache.connect().catch(console.error);

// Initialize and start background job service
const backgroundJobService = new BackgroundJobService();
backgroundJobService.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  backgroundJobService.stop();
  await cache.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  backgroundJobService.stop();
  await cache.disconnect();
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

// Add status endpoint to check background job service and cache
app.get("/status", async function (req: any, res: any) {
  const jobStatus = backgroundJobService.getStatus();
  const cacheStats = await cache.getStats();
  
  res.json({
    status: "operational",
    backgroundJobs: {
      alertComputation: jobStatus,
    },
    cache: cacheStats,
    timestamp: new Date(),
  });
});

// Cache management endpoints
app.get("/admin/cache/stats", async function (req: any, res: any) {
  try {
    const stats = await cache.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

app.delete("/admin/cache/:pattern", async function (req: any, res: any) {
  try {
    const pattern = req.params.pattern;
    const deletedCount = await cache.invalidatePattern(pattern);
    res.json({ 
      message: `Invalidated cache entries matching pattern: ${pattern}`,
      deletedCount 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to invalidate cache" });
  }
});

app.delete("/admin/cache", async function (req: any, res: any) {
  try {
    const deletedCount = await cache.invalidatePattern("*");
    res.json({ 
      message: "All cache entries invalidated",
      deletedCount 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

export default app;
