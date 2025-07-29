import { MotorqService } from "./motorq";
import { Telemetry } from "../types/Telemetry";

export class TelemetryService {
  private motorqService: MotorqService;

  constructor() {
    this.motorqService = new MotorqService();
  }

  async addTelemetry(vehicleId: number, telemetry: Telemetry): Promise<boolean> {
    return await this.motorqService.addTelemetry(vehicleId, telemetry);
  }

  async getLatestTelemetry(vehicleId: number): Promise<any> {
    return await this.motorqService.getLatestTelemetry(vehicleId);
  }

  async getTelemetryHistory(vehicleId: number): Promise<any> {
    return await this.motorqService.getTelemetryHistory(vehicleId);
  }
}
