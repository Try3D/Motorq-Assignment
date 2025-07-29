import { Vehicle } from "./Vehicle";

interface FleetProps {
  fleetId: number;
  fleetType: FleetType;
  ownerId: number;
  vehicles: Vehicle[];
}

type FleetType = "Corporate" | "Rental" | "Personal";

export class Fleet {
  fleetId: number;
  fleetType: FleetType;
  ownerId: number;
  vehicles: Vehicle[];

  constructor(fP: FleetProps) {
    this.fleetId = fP.fleetId;
    this.fleetType = fP.fleetType;
    this.ownerId = fP.ownerId;
    this.vehicles = fP.vehicles;
  }

  public vehiclesOwned(): Vehicle[] {
    return this.vehicles;
  }
}
