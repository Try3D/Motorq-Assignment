import { MotorqService } from "./motorq";
import { Vehicle } from "../types/Vehicle";

export class VehicleService {
  private motorqService: MotorqService;

  constructor() {
    this.motorqService = new MotorqService();
  }

  async addVehicle(fleetId: number, vehicle: Vehicle): Promise<boolean> {
    return await this.motorqService.addVehicle(fleetId, vehicle);
  }

  async getAllVehicles(): Promise<any> {
    return await this.motorqService.getAllVehicles();
  }

  async deleteVehicle(vehicleId: number): Promise<boolean> {
    return await this.motorqService.deleteVehicle(vehicleId);
  }
}
