import { Owner } from "../types/Owner";
import { Fleet } from "../types/Fleet";
import { Vehicle } from "../types/Vehicle";
import { Telemetry } from "../types/Telemetry";
import pool from "../database/connection";

export class MotorqService {
  async addOwner(owner: Owner): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query(
        "INSERT INTO owners (owner_id, name) VALUES ($1, $2)",
        [owner.ownerId, owner.name],
      );
      return true;
    } catch (error) {
      console.error("Error adding owner:", error);
      return false;
    } finally {
      client.release();
    }
  }

  async addFleet(ownerId: number, fleet: Fleet): Promise<boolean> {
    const client = await pool.connect();
    try {
      const ownerResult = await client.query(
        "SELECT owner_id FROM owners WHERE owner_id = $1",
        [ownerId],
      );

      if (ownerResult.rows.length === 0) {
        return false;
      }

      await client.query(
        "INSERT INTO fleets (fleet_id, fleet_type, owner_id) VALUES ($1, $2, $3)",
        [fleet.fleetId, fleet.fleetType, ownerId],
      );
      return true;
    } catch (error) {
      console.error("Error adding fleet:", error);
      return false;
    } finally {
      client.release();
    }
  }

  async addVehicle(fleetId: number, vehicle: Vehicle): Promise<boolean> {
    const client = await pool.connect();
    try {
      const fleetResult = await client.query(
        "SELECT fleet_id FROM fleets WHERE fleet_id = $1",
        [fleetId],
      );

      if (fleetResult.rows.length === 0) {
        return false;
      }

      await client.query(
        "INSERT INTO vehicles (vin, manufacturer, fleet_id, registration_status) VALUES ($1, $2, $3, $4)",
        [
          vehicle.vin,
          vehicle.manufacturer,
          fleetId,
          vehicle.registrationStatus,
        ],
      );
      return true;
    } catch (error) {
      console.error("Error adding vehicle:", error);
      return false;
    } finally {
      client.release();
    }
  }

  async addTelemetry(
    vehicleId: number,
    telemetry: Telemetry,
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      const vehicleResult = await client.query(
        "SELECT vin FROM vehicles WHERE vin = $1",
        [vehicleId],
      );

      if (vehicleResult.rows.length === 0) {
        return false;
      }

      await client.query(
        "INSERT INTO telemetry (vehicle_vin, latitude, longitude, speed, engine_status, fuel, total_km, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          vehicleId,
          telemetry.gps.latitude,
          telemetry.gps.longitude,
          telemetry.speed,
          telemetry.engineStatus,
          telemetry.fuel,
          telemetry.totalKm,
          telemetry.timeStamp,
        ],
      );

      return true;
    } catch (error) {
      console.error("Error adding telemetry:", error);
      return false;
    } finally {
      client.release();
    }
  }

  async getAllData(): Promise<any> {
    const client = await pool.connect();
    try {
      const ownersResult = await client.query(`
        SELECT 
          o.owner_id, o.name,
          f.fleet_id, f.fleet_type,
          v.vin, v.manufacturer, v.registration_status,
          t.latitude, t.longitude, t.speed, t.engine_status, t.fuel, t.total_km, t.timestamp
        FROM owners o
        LEFT JOIN fleets f ON o.owner_id = f.owner_id
        LEFT JOIN vehicles v ON f.fleet_id = v.fleet_id
        LEFT JOIN telemetry t ON v.vin = t.vehicle_vin
        ORDER BY o.owner_id, f.fleet_id, v.vin, t.timestamp DESC
      `);

      const ownersMap = new Map<
        number,
        {
          ownerId: number;
          name: string;
          fleets: Map<
            number,
            {
              fleetId: number;
              fleetType: string;
              ownerId: number;
              vehicles: Map<
                number,
                {
                  vin: number;
                  manufacturer: string;
                  fleetId: number;
                  registrationStatus: string;
                  telemetryData: any[];
                }
              >;
            }
          >;
        }
      >();

      for (const row of ownersResult.rows) {
        if (!ownersMap.has(row.owner_id)) {
          ownersMap.set(row.owner_id, {
            ownerId: row.owner_id,
            name: row.name,
            fleets: new Map(),
          });
        }

        const owner = ownersMap.get(row.owner_id)!;

        if (row.fleet_id && !owner.fleets.has(row.fleet_id)) {
          owner.fleets.set(row.fleet_id, {
            fleetId: row.fleet_id,
            fleetType: row.fleet_type,
            ownerId: row.owner_id,
            vehicles: new Map(),
          });
        }

        if (row.vin && row.fleet_id) {
          const fleet = owner.fleets.get(row.fleet_id)!;
          if (!fleet.vehicles.has(row.vin)) {
            fleet.vehicles.set(row.vin, {
              vin: row.vin,
              manufacturer: row.manufacturer,
              fleetId: row.fleet_id,
              registrationStatus: row.registration_status,
              telemetryData: [],
            });
          }

          if (row.latitude !== null) {
            const vehicle = fleet.vehicles.get(row.vin)!;
            vehicle.telemetryData.push({
              gps: { latitude: row.latitude, longitude: row.longitude },
              speed: row.speed,
              engineStatus: row.engine_status,
              fuel: row.fuel,
              totalKm: row.total_km,
              timeStamp: row.timestamp,
            });
          }
        }
      }

      const owners = Array.from(ownersMap.values()).map((owner) => ({
        ownerId: owner.ownerId,
        name: owner.name,
        fleets: Array.from(owner.fleets.values()).map((fleet) => ({
          fleetId: fleet.fleetId,
          fleetType: fleet.fleetType,
          ownerId: fleet.ownerId,
          vehicles: Array.from(fleet.vehicles.values()),
        })),
      }));

      return { owners };
    } catch (error) {
      console.error("Error getting all data:", error);
      return { owners: [] };
    } finally {
      client.release();
    }
  }

  async getFleetAnalytics(fleetId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const fleetResult = await client.query(
        "SELECT fleet_id, fleet_type, owner_id FROM fleets WHERE fleet_id = $1",
        [fleetId],
      );

      if (fleetResult.rows.length === 0) {
        return { error: "Fleet not found" };
      }

      const fleet = fleetResult.rows[0];

      const vehicleStatusResult = await client.query(
        `
        SELECT 
          registration_status,
          COUNT(*) as count
        FROM vehicles 
        WHERE fleet_id = $1 
        GROUP BY registration_status
      `,
        [fleetId],
      );

      const latestTelemetryResult = await client.query(
        `
        WITH latest_telemetry AS (
          SELECT DISTINCT ON (vehicle_vin) 
            vehicle_vin, latitude, longitude, speed, engine_status, fuel, total_km, timestamp
          FROM telemetry t
          WHERE vehicle_vin IN (SELECT vin FROM vehicles WHERE fleet_id = $1)
          ORDER BY vehicle_vin, timestamp DESC
        )
        SELECT * FROM latest_telemetry
      `,
        [fleetId],
      );

      const vehicleStats = {
        active: 0,
        maintenance: 0,
        decommissioned: 0,
      };

      vehicleStatusResult.rows.forEach((row) => {
        if (row.registration_status === "Active")
          vehicleStats.active = parseInt(row.count);
        if (row.registration_status === "Maintanance")
          vehicleStats.maintenance = parseInt(row.count);
        if (row.registration_status === "Decommissioned")
          vehicleStats.decommissioned = parseInt(row.count);
      });

      let totalFuel = 0;
      let totalDistance = 0;
      let vehicleCount = latestTelemetryResult.rows.length;

      latestTelemetryResult.rows.forEach((row) => {
        totalFuel += parseFloat(row.fuel) || 0;
        totalDistance += parseFloat(row.total_km) || 0;
      });

      const averageFuel =
        vehicleCount > 0 ? (totalFuel / vehicleCount).toFixed(2) : "0";

      return {
        fleetId: fleet.fleet_id,
        fleetType: fleet.fleet_type,
        ownerId: fleet.owner_id,
        vehicleStats,
        averageFuelLevel: parseFloat(averageFuel),
        totalFleetDistance: parseFloat(totalDistance.toFixed(2)),
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("Error getting fleet analytics:", error);
      return { error: "Failed to get fleet analytics" };
    } finally {
      client.release();
    }
  }

  async getFleetDistance24Hours(fleetId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        WITH vehicle_distance AS (
          SELECT 
            vehicle_vin,
            MIN(total_km) as start_km,
            MAX(total_km) as end_km
          FROM telemetry t
          WHERE vehicle_vin IN (SELECT vin FROM vehicles WHERE fleet_id = $1)
            AND timestamp >= NOW() - INTERVAL '24 hours'
          GROUP BY vehicle_vin
        )
        SELECT 
          vehicle_vin,
          (end_km - start_km) as distance_24h
        FROM vehicle_distance
      `,
        [fleetId],
      );

      let totalDistance24h = 0;
      const vehicleDistances = result.rows.map((row) => {
        const distance = parseFloat(row.distance_24h) || 0;
        totalDistance24h += distance;
        return {
          vehicleVin: row.vehicle_vin,
          distance24h: distance,
        };
      });

      return {
        fleetId,
        totalDistance24h: parseFloat(totalDistance24h.toFixed(2)),
        vehicleDistances,
        timeframe: "24 hours",
      };
    } catch (error) {
      console.error("Error getting 24h distance:", error);
      return { error: "Failed to get 24h distance data" };
    } finally {
      client.release();
    }
  }

  async getFleetAlerts(fleetId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          a.id, a.vehicle_vin, a.alert_type, a.severity, a.message,
          a.threshold_value, a.actual_value, a.is_resolved, 
          a.triggered_at, a.resolved_at
        FROM alerts a
        WHERE a.vehicle_vin IN (SELECT vin FROM vehicles WHERE fleet_id = $1)
        AND a.is_resolved = FALSE
        ORDER BY a.triggered_at DESC
      `,
        [fleetId],
      );

      const alertSummary = {
        critical: 0,
        warning: 0,
        info: 0,
      };

      const alertsByType = {
        "Speed Violation": 0,
        "Low Fuel": 0,
        "Engine Status": 0,
        Maintenance: 0,
      };

      result.rows.forEach((row) => {
        if (row.severity === "Critical") alertSummary.critical++;
        else if (row.severity === "Warning") alertSummary.warning++;
        else alertSummary.info++;

        alertsByType[row.alert_type as keyof typeof alertsByType]++;
      });

      return {
        fleetId,
        alertSummary: {
          ...alertSummary,
          total:
            alertSummary.critical + alertSummary.warning + alertSummary.info,
        },
        alertsByType,
        alerts: result.rows.map((row) => ({
          id: row.id,
          vehicleVin: row.vehicle_vin,
          type: row.alert_type,
          severity: row.severity,
          message: row.message,
          thresholdValue: row.threshold_value,
          actualValue: row.actual_value,
          isResolved: row.is_resolved,
          triggeredAt: row.triggered_at,
          resolvedAt: row.resolved_at,
        })),
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error("Error getting fleet alerts:", error);
      return { error: "Failed to get fleet alerts" };
    } finally {
      client.release();
    }
  }

  async resolveAlert(alertId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        UPDATE alerts 
        SET is_resolved = TRUE, resolved_at = NOW() 
        WHERE id = $1 AND is_resolved = FALSE
      `,
        [alertId],
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error resolving alert:", error);
      return false;
    } finally {
      client.release();
    }
  }

  async getVehicleAlerts(vehicleVin: number): Promise<any> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          id, alert_type, severity, message, threshold_value, 
          actual_value, is_resolved, triggered_at, resolved_at
        FROM alerts 
        WHERE vehicle_vin = $1 
        ORDER BY triggered_at DESC
        LIMIT 50
      `,
        [vehicleVin],
      );

      return {
        vehicleVin,
        alerts: result.rows,
        totalAlerts: result.rows.length,
      };
    } catch (error) {
      console.error("Error getting vehicle alerts:", error);
      return { error: "Failed to get vehicle alerts" };
    } finally {
      client.release();
    }
  }

  async getAllVehicles(): Promise<any> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          v.vin, v.manufacturer, v.fleet_id, v.registration_status,
          f.fleet_type, f.owner_id
        FROM vehicles v
        LEFT JOIN fleets f ON v.fleet_id = f.fleet_id
        ORDER BY v.vin
      `);

      return {
        vehicles: result.rows.map((row) => ({
          vin: row.vin,
          manufacturer: row.manufacturer,
          fleetId: row.fleet_id,
          registrationStatus: row.registration_status,
          fleetType: row.fleet_type,
          ownerId: row.owner_id,
        })),
      };
    } catch (error) {
      console.error("Error getting all vehicles:", error);
      return { error: "Failed to get vehicles" };
    } finally {
      client.release();
    }
  }

  async getVehiclesByFleet(fleetId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const fleetResult = await client.query(
        "SELECT fleet_id FROM fleets WHERE fleet_id = $1",
        [fleetId],
      );

      if (fleetResult.rows.length === 0) {
        return { error: "Fleet not found" };
      }

      const result = await client.query(
        `
        SELECT vin, manufacturer, fleet_id, registration_status
        FROM vehicles 
        WHERE fleet_id = $1
        ORDER BY vin
      `,
        [fleetId],
      );

      return {
        fleetId,
        vehicles: result.rows.map((row) => ({
          vin: row.vin,
          manufacturer: row.manufacturer,
          fleetId: row.fleet_id,
          registrationStatus: row.registration_status,
        })),
      };
    } catch (error) {
      console.error("Error getting fleet vehicles:", error);
      return { error: "Failed to get fleet vehicles" };
    } finally {
      client.release();
    }
  }

  async deleteVehicle(vehicleId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query("DELETE FROM telemetry WHERE vehicle_vin = $1", [
        vehicleId,
      ]);

      await client.query("DELETE FROM alerts WHERE vehicle_vin = $1", [
        vehicleId,
      ]);

      const result = await client.query("DELETE FROM vehicles WHERE vin = $1", [
        vehicleId,
      ]);

      await client.query("COMMIT");

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error deleting vehicle:", error);
      return false;
    } finally {
      client.release();
    }
  }

  async getLatestTelemetry(vehicleId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const vehicleResult = await client.query(
        "SELECT vin FROM vehicles WHERE vin = $1",
        [vehicleId],
      );

      if (vehicleResult.rows.length === 0) {
        return { error: "Vehicle not found" };
      }

      const result = await client.query(
        `
        SELECT latitude, longitude, speed, engine_status, fuel, total_km, timestamp
        FROM telemetry 
        WHERE vehicle_vin = $1 
        ORDER BY timestamp DESC 
        LIMIT 1
      `,
        [vehicleId],
      );

      if (result.rows.length === 0) {
        return { error: "No telemetry data found for this vehicle" };
      }

      const row = result.rows[0];
      return {
        vehicleId,
        telemetry: {
          gps: { latitude: row.latitude, longitude: row.longitude },
          speed: row.speed,
          engineStatus: row.engine_status,
          fuel: row.fuel,
          totalKm: row.total_km,
          timeStamp: row.timestamp,
        },
      };
    } catch (error) {
      console.error("Error getting latest telemetry:", error);
      return { error: "Failed to get latest telemetry" };
    } finally {
      client.release();
    }
  }

  async getTelemetryHistory(vehicleId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const vehicleResult = await client.query(
        "SELECT vin FROM vehicles WHERE vin = $1",
        [vehicleId],
      );

      if (vehicleResult.rows.length === 0) {
        return { error: "Vehicle not found" };
      }

      const result = await client.query(
        `
        SELECT latitude, longitude, speed, engine_status, fuel, total_km, timestamp
        FROM telemetry 
        WHERE vehicle_vin = $1 
        ORDER BY timestamp DESC 
        LIMIT 100
      `,
        [vehicleId],
      );

      return {
        vehicleId,
        telemetryHistory: result.rows.map((row) => ({
          gps: { latitude: row.latitude, longitude: row.longitude },
          speed: row.speed,
          engineStatus: row.engine_status,
          fuel: row.fuel,
          totalKm: row.total_km,
          timeStamp: row.timestamp,
        })),
        totalRecords: result.rows.length,
      };
    } catch (error) {
      console.error("Error getting telemetry history:", error);
      return { error: "Failed to get telemetry history" };
    } finally {
      client.release();
    }
  }
}
