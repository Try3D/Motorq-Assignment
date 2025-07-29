import { MotorqService } from "./motorq";

export class AlertService {
  private motorqService: MotorqService;

  constructor() {
    this.motorqService = new MotorqService();
  }

  async resolveAlert(alertId: number): Promise<boolean> {
    return await this.motorqService.resolveAlert(alertId);
  }

  async getVehicleAlerts(vehicleVin: number): Promise<any> {
    return await this.motorqService.getVehicleAlerts(vehicleVin);
  }
}
