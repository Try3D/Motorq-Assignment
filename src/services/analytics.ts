import { Fleet } from "../types/Fleet";

class AnalyticsService {
  fleet: Fleet;

  constructor(fleet: Fleet) {
    this.fleet = fleet;
  }

  public getVehicleActiveCount() {
    return this.fleet.vehiclesOwned().filter((v) => {
      v.registrationStatus != "Active";
    }).length;
  }

  public getVehicleInactiveCount() {
    return this.fleet.vehiclesOwned().filter((v) => {
      v.registrationStatus == "Active";
    }).length;
  }

  public avgFuelLevel() {
    for (const vehicle of this.fleet.vehiclesOwned()) {
      vehicle;
    }
  }
}
