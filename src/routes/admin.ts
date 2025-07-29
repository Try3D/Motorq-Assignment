import express from "express";
import { VehicleAuthService } from "../middleware/vehicleAuth";
import { RateLimitMonitor } from "../middleware/rateLimiter";
import pool from "../database/connection";

const router = express.Router();

// Provision API key for a vehicle
router.post("/vehicle/provision", async function (req: any, res: any) {
  try {
    const { vehicleVin, technicianId } = req.body;

    if (!vehicleVin || !technicianId) {
      return res.status(400).json({ 
        error: "vehicleVin and technicianId are required" 
      });
    }

    const apiKey = await VehicleAuthService.provisionVehicle(
      parseInt(vehicleVin), 
      technicianId
    );

    if (!apiKey) {
      return res.status(400).json({ 
        error: "Failed to provision vehicle. Vehicle may not exist or already be provisioned." 
      });
    }

    res.json({
      message: "Vehicle provisioned successfully",
      vehicleVin: parseInt(vehicleVin),
      apiKey,
      instructions: "Store this API key securely in the vehicle's onboard computer. Include it as 'X-Vehicle-API-Key' header in all telemetry requests."
    });
  } catch (error) {
    console.error("Provisioning error:", error);
    res.status(500).json({ error: "Failed to provision vehicle" });
  }
});

// Revoke API key for a vehicle
router.post("/vehicle/revoke", async function (req: any, res: any) {
  try {
    const { vehicleVin } = req.body;

    if (!vehicleVin) {
      return res.status(400).json({ 
        error: "vehicleVin is required" 
      });
    }

    const revoked = await VehicleAuthService.revokeVehicle(parseInt(vehicleVin));

    if (!revoked) {
      return res.status(404).json({ 
        error: "Vehicle not found or already revoked" 
      });
    }

    res.json({
      message: "Vehicle API key revoked successfully",
      vehicleVin: parseInt(vehicleVin)
    });
  } catch (error) {
    console.error("Revocation error:", error);
    res.status(500).json({ error: "Failed to revoke vehicle access" });
  }
});

// List all vehicle authentication statuses
router.get("/vehicles/auth-status", async function (req: any, res: any) {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          v.vin, v.manufacturer, v.fleet_id, v.registration_status,
          va.status as auth_status, va.api_key_prefix, 
          va.provisioned_by, va.provisioned_at, va.last_used_at
        FROM vehicles v
        LEFT JOIN vehicle_auth va ON v.vin = va.vehicle_vin
        ORDER BY v.vin
      `);

      const vehicles = result.rows.map(row => ({
        vin: row.vin,
        manufacturer: row.manufacturer,
        fleetId: row.fleet_id,
        registrationStatus: row.registration_status,
        authStatus: row.auth_status || 'not_provisioned',
        apiKeyPrefix: row.api_key_prefix,
        provisionedBy: row.provisioned_by,
        provisionedAt: row.provisioned_at,
        lastUsedAt: row.last_used_at
      }));

      res.json({
        vehicles,
        summary: {
          total: vehicles.length,
          provisioned: vehicles.filter(v => v.authStatus === 'active').length,
          revoked: vehicles.filter(v => v.authStatus === 'revoked').length,
          notProvisioned: vehicles.filter(v => v.authStatus === 'not_provisioned').length
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching auth status:", error);
    res.status(500).json({ error: "Failed to get vehicle auth status" });
  }
});

// Get rate limiting stats for a specific vehicle
router.get("/vehicle/:vehicleVin/rate-stats", async function (req: any, res: any) {
  try {
    const vehicleVin = parseInt(req.params.vehicleVin);

    if (isNaN(vehicleVin)) {
      return res.status(400).json({ error: "Invalid vehicle VIN" });
    }

    const stats = await RateLimitMonitor.getVehicleRateStats(vehicleVin);
    res.json(stats);
  } catch (error) {
    console.error("Error getting rate stats:", error);
    res.status(500).json({ error: "Failed to get rate limiting stats" });
  }
});

// Get top requesting vehicles
router.get("/vehicles/top-requesters", async function (req: any, res: any) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const topRequesters = await RateLimitMonitor.getTopRequesters(limit);
    res.json(topRequesters);
  } catch (error) {
    console.error("Error getting top requesters:", error);
    res.status(500).json({ error: "Failed to get top requesters" });
  }
});

// Update rate limit for a vehicle
router.post("/vehicle/:vehicleVin/rate-limit", async function (req: any, res: any) {
  try {
    const vehicleVin = parseInt(req.params.vehicleVin);
    const { rateLimitPerHour } = req.body;

    if (isNaN(vehicleVin) || isNaN(rateLimitPerHour)) {
      return res.status(400).json({ 
        error: "Invalid vehicleVin or rateLimitPerHour" 
      });
    }

    if (rateLimitPerHour < 60 || rateLimitPerHour > 10000) {
      return res.status(400).json({ 
        error: "Rate limit must be between 60 and 10000 requests per hour" 
      });
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        UPDATE vehicle_auth 
        SET rate_limit_per_hour = $1 
        WHERE vehicle_vin = $2 AND status = 'active'
      `, [rateLimitPerHour, vehicleVin]);

      if (result.rowCount === 0) {
        return res.status(404).json({ 
          error: "Vehicle not found or not active" 
        });
      }

      res.json({
        message: "Rate limit updated successfully",
        vehicleVin,
        newRateLimit: rateLimitPerHour
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating rate limit:", error);
    res.status(500).json({ error: "Failed to update rate limit" });
  }
});

// Clear request logs for a vehicle (reset rate limiting)
router.post("/vehicle/:vehicleVin/reset-rate-limit", async function (req: any, res: any) {
  try {
    const vehicleVin = parseInt(req.params.vehicleVin);

    if (isNaN(vehicleVin)) {
      return res.status(400).json({ error: "Invalid vehicle VIN" });
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        DELETE FROM vehicle_request_logs 
        WHERE vehicle_vin = $1
      `, [vehicleVin]);

      res.json({
        message: "Rate limit reset successfully",
        vehicleVin,
        clearedRecords: result.rowCount
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error resetting rate limit:", error);
    res.status(500).json({ error: "Failed to reset rate limit" });
  }
});

export default router;
