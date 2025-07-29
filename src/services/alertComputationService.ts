import pool from "../database/connection";
import { Alert } from "../types/Alert";

export class AlertComputationService {
  async computeAndStoreAlerts(): Promise<void> {
    const client = await pool.connect();

    try {
      console.log("🔍 Computing alerts for all fleets...");

      // Get all vehicles with their latest telemetry
      const vehiclesWithTelemetry = await client.query(`
        WITH latest_telemetry AS (
          SELECT DISTINCT ON (vehicle_vin) 
            vehicle_vin, latitude, longitude, speed, engine_status, fuel, total_km, timestamp
          FROM telemetry 
          ORDER BY vehicle_vin, timestamp DESC
        )
        SELECT 
          v.vin, v.fleet_id, v.manufacturer, v.registration_status,
          lt.latitude, lt.longitude, lt.speed, lt.engine_status, lt.fuel, lt.total_km, lt.timestamp
        FROM vehicles v
        LEFT JOIN latest_telemetry lt ON v.vin = lt.vehicle_vin
        WHERE v.registration_status = 'Active'
        AND lt.timestamp IS NOT NULL
        AND lt.timestamp > NOW() - INTERVAL '5 minutes'
      `);

      if (vehiclesWithTelemetry.rows.length === 0) {
        console.log("ℹ️ No active vehicles with recent telemetry data found");
        return;
      }

      const newAlerts: Alert[] = [];
      const now = new Date();

      for (const vehicle of vehiclesWithTelemetry.rows) {
        const vehicleVin = vehicle.vin;
        const speed = parseFloat(vehicle.speed) || 0;
        const fuel = parseFloat(vehicle.fuel) || 0;

        if (speed > 80) {
          const existingSpeedAlert = await client.query(
            `
            SELECT id FROM alerts 
            WHERE vehicle_vin = $1 AND alert_type = 'Speed Violation' 
            AND is_resolved = FALSE 
            AND triggered_at > NOW() - INTERVAL '5 minutes'
          `,
            [vehicleVin],
          );

          if (existingSpeedAlert.rows.length === 0) {
            newAlerts.push(
              new Alert({
                vehicleVin,
                alertType: "Speed Violation",
                severity: speed > 100 ? "Critical" : "Warning",
                message: `Vehicle ${vehicleVin} is speeding at ${speed} km/h (limit: 80 km/h)`,
                thresholdValue: 80,
                actualValue: speed,
                triggeredAt: now,
              }),
            );
          }
        }

        if (fuel < 15) {
          const existingFuelAlert = await client.query(
            `
            SELECT id FROM alerts 
            WHERE vehicle_vin = $1 AND alert_type = 'Low Fuel' 
            AND is_resolved = FALSE 
            AND triggered_at > NOW() - INTERVAL '10 minutes'
          `,
            [vehicleVin],
          );

          if (existingFuelAlert.rows.length === 0) {
            newAlerts.push(
              new Alert({
                vehicleVin,
                alertType: "Low Fuel",
                severity: fuel < 5 ? "Critical" : "Warning",
                message: `Vehicle ${vehicleVin} has low fuel: ${fuel}%`,
                thresholdValue: 15,
                actualValue: fuel,
                triggeredAt: now,
              }),
            );
          }
        }

        if (vehicle.engine_status === "Off" && speed > 0) {
          const existingEngineAlert = await client.query(
            `
            SELECT id FROM alerts 
            WHERE vehicle_vin = $1 AND alert_type = 'Engine Status' 
            AND is_resolved = FALSE 
            AND triggered_at > NOW() - INTERVAL '5 minutes'
          `,
            [vehicleVin],
          );

          if (existingEngineAlert.rows.length === 0) {
            newAlerts.push(
              new Alert({
                vehicleVin,
                alertType: "Engine Status",
                severity: "Warning",
                message: `Vehicle ${vehicleVin} engine is off but showing movement`,
                thresholdValue: 0,
                actualValue: speed,
                triggeredAt: now,
              }),
            );
          }
        }
      }

      for (const alert of newAlerts) {
        await client.query(
          `
          INSERT INTO alerts (vehicle_vin, alert_type, severity, message, threshold_value, actual_value, triggered_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [
            alert.vehicleVin,
            alert.alertType,
            alert.severity,
            alert.message,
            alert.thresholdValue,
            alert.actualValue,
            alert.triggeredAt,
          ],
        );

        console.log(`🚨 Alert stored: ${alert.message}`);
      }

      if (newAlerts.length > 0) {
        console.log(`✅ Stored ${newAlerts.length} new alerts`);
      } else {
        console.log("ℹ️ No new alerts to store");
      }

      await this.autoResolveOldAlerts(client);
    } catch (error) {
      console.error("❌ Error computing alerts:", error);
    } finally {
      client.release();
    }
  }

  private async autoResolveOldAlerts(client: any): Promise<void> {
    try {
      const speedAlertsResolved = await client.query(`
        UPDATE alerts 
        SET is_resolved = TRUE, resolved_at = NOW()
        WHERE alert_type = 'Speed Violation' 
        AND is_resolved = FALSE
        AND vehicle_vin IN (
          SELECT DISTINCT ON (vehicle_vin) vehicle_vin
          FROM telemetry
          WHERE timestamp > NOW() - INTERVAL '2 minutes'
          AND speed <= 80
          ORDER BY vehicle_vin, timestamp DESC
        )
      `);

      const fuelAlertsResolved = await client.query(`
        UPDATE alerts 
        SET is_resolved = TRUE, resolved_at = NOW()
        WHERE alert_type = 'Low Fuel' 
        AND is_resolved = FALSE
        AND vehicle_vin IN (
          SELECT DISTINCT ON (vehicle_vin) vehicle_vin
          FROM telemetry
          WHERE timestamp > NOW() - INTERVAL '2 minutes'
          AND fuel >= 20
          ORDER BY vehicle_vin, timestamp DESC
        )
      `);

      const totalResolved =
        (speedAlertsResolved.rowCount || 0) +
        (fuelAlertsResolved.rowCount || 0);
      if (totalResolved > 0) {
        console.log(`✅ Auto-resolved ${totalResolved} alerts`);
      }
    } catch (error) {
      console.error("❌ Error auto-resolving alerts:", error);
    }
  }
}
