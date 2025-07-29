import { Request, Response, NextFunction } from "express";
import pool from "../database/connection";
import crypto from "crypto";

interface AuthenticatedRequest extends Request {
  vehicle?: {
    vin: number;
    fleetId: number;
    manufacturer: string;
    registrationStatus: string;
  };
}

export class VehicleAuthService {
  static generateApiKey(vehicleVin: number): string {
    const randomPart = crypto.randomBytes(16).toString("hex");
    return `veh_${vehicleVin}_${randomPart}`;
  }

  static hashApiKey(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex");
  }

  static getApiKeyPrefix(apiKey: string): string {
    return apiKey.substring(0, 16);
  }

  static async authenticateVehicle(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const apiKey = req.headers["x-vehicle-api-key"] as string;

      if (!apiKey) {
        res.status(401).json({
          error: "Missing API key. Include X-Vehicle-API-Key header.",
        });
        return;
      }

      if (!apiKey.startsWith("veh_")) {
        res.status(401).json({
          error: "Invalid API key format",
        });
        return;
      }

      const hashedKey = VehicleAuthService.hashApiKey(apiKey);
      const client = await pool.connect();

      try {
        const authResult = await client.query(
          `
          SELECT va.vehicle_vin, va.status, va.last_used_at, va.rate_limit_per_hour,
                 v.fleet_id, v.manufacturer, v.registration_status
          FROM vehicle_auth va
          JOIN vehicles v ON va.vehicle_vin = v.vin
          WHERE va.api_key_hash = $1 AND va.status = 'active'
        `,
          [hashedKey],
        );

        if (authResult.rows.length === 0) {
          res.status(401).json({
            error: "Invalid or inactive API key",
          });
          return;
        }

        const vehicleAuth = authResult.rows[0];

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (
          vehicleAuth.last_used_at &&
          new Date(vehicleAuth.last_used_at) > oneHourAgo
        ) {
        }

        await client.query(
          `
          UPDATE vehicle_auth 
          SET last_used_at = NOW() 
          WHERE vehicle_vin = $1
        `,
          [vehicleAuth.vehicle_vin],
        );

        req.vehicle = {
          vin: vehicleAuth.vehicle_vin,
          fleetId: vehicleAuth.fleet_id,
          manufacturer: vehicleAuth.manufacturer,
          registrationStatus: vehicleAuth.registration_status,
        };

        next();
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Authentication error:", error);
      res.status(500).json({
        error: "Authentication service error",
      });
    }
  }

  static async provisionVehicle(
    vehicleVin: number,
    provisionedBy: string,
  ): Promise<string | null> {
    const client = await pool.connect();

    try {
      const vehicleResult = await client.query(
        "SELECT vin FROM vehicles WHERE vin = $1",
        [vehicleVin],
      );

      if (vehicleResult.rows.length === 0) {
        throw new Error("Vehicle not found");
      }

      const existingAuth = await client.query(
        "SELECT id FROM vehicle_auth WHERE vehicle_vin = $1",
        [vehicleVin],
      );

      if (existingAuth.rows.length > 0) {
        throw new Error("Vehicle already provisioned");
      }

      const apiKey = VehicleAuthService.generateApiKey(vehicleVin);
      const hashedKey = VehicleAuthService.hashApiKey(apiKey);
      const prefix = VehicleAuthService.getApiKeyPrefix(apiKey);

      await client.query(
        `
        INSERT INTO vehicle_auth (
          vehicle_vin, api_key_hash, api_key_prefix, status, 
          provisioned_by, provisioned_at
        ) VALUES ($1, $2, $3, 'active', $4, NOW())
      `,
        [vehicleVin, hashedKey, prefix, provisionedBy],
      );

      return apiKey;
    } catch (error) {
      console.error("Provisioning error:", error);
      return null;
    } finally {
      client.release();
    }
  }

  static async revokeVehicle(vehicleVin: number): Promise<boolean> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `
        UPDATE vehicle_auth 
        SET status = 'revoked' 
        WHERE vehicle_vin = $1 AND status = 'active'
      `,
        [vehicleVin],
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Revocation error:", error);
      return false;
    } finally {
      client.release();
    }
  }
}

export { AuthenticatedRequest };
