import { Owner } from "../types/Owner";
import { Fleet } from "../types/Fleet";
import { Vehicle } from "../types/Vehicle";
import { Telemetry } from "../types/Telemetry";

interface MotorqProps {
  owners: Owner[];
}

export class MotorqService {
  owners: Owner[];

  public constructor(mp: MotorqProps) {
    this.owners = mp.owners;
  }

  addOwner(owner: Owner): boolean {
    this.owners.push(owner);
    return true;
  }

  addFleet(ownerId: number, fleet: Fleet): boolean {
    const owner = this.getOwner(ownerId);

    if (!owner) {
      return false;
    }

    owner.fleets.push(fleet);
    return true;
  }

  addVehicle(fleetId: number, vehicle: Vehicle): boolean {
    const fleet = this.getFleet(fleetId);

    if (!fleet) {
      return false;
    }

    fleet.vehicles.push(vehicle);
    return true;
  }

  addTelemetry(vehicleId: number, telemetry: Telemetry): boolean {
    const vehicle = this.getVehicle(vehicleId);

    if (!vehicle) {
      return false;
    }

    vehicle.telemetryData.push(telemetry);
    return true;
  }

  private getOwner(ownerId: number): Owner | null {
    return this.owners.filter((owner) => owner.ownerId == ownerId)[0] ?? null;
  }

  private getFleet(fleetId: number): Fleet | null {
    for (const owner of this.owners) {
      for (const fleet of owner.fleets) {
        if (fleet.fleetId == fleetId) {
          return fleet;
        }
      }
    }

    return null;
  }

  private getVehicle(vin: number): Vehicle | null {
    for (const owner of this.owners) {
      for (const fleet of owner.fleets) {
        for (const vehicle of fleet.vehicles) {
          if (vehicle.vin == vin) {
            return vehicle;
          }
        }
      }
    }

    return null;
  }
}
