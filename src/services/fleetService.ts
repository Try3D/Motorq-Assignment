import { MotorqService } from "./motorq";
import { Fleet } from "../types/Fleet";

export class FleetService {
  private motorqService: MotorqService;

  constructor() {
    this.motorqService = new MotorqService();
  }

  async addFleet(ownerId: number, fleet: Fleet): Promise<boolean> {
    return await this.motorqService.addFleet(ownerId, fleet);
  }

  async getFleetAnalytics(fleetId: number): Promise<any> {
    return await this.motorqService.getFleetAnalytics(fleetId);
  }

  async getFleetDistance24Hours(fleetId: number): Promise<any> {
    return await this.motorqService.getFleetDistance24Hours(fleetId);
  }

  async getFleetAlerts(fleetId: number): Promise<any> {
    return await this.motorqService.getFleetAlerts(fleetId);
  }

  async getVehiclesByFleet(fleetId: number): Promise<any> {
    return await this.motorqService.getVehiclesByFleet(fleetId);
  }
}
