import { Owner } from "./Owner";
import { Vehicle } from "./Vehicle";

interface FleetProps {
  fleetId: number;
  fleetType: FleetType;
  ownerId: number;
}

type FleetType = "Corporate" | "Rental" | "Personal";

export class Fleet {
  fleetId: number;
  fleetType: FleetType;
  ownerId: number;

  constructor(fP: FleetProps) {
    this.fleetId = fP.fleetId;
    this.fleetType = fP.fleetType;
    this.ownerId = fP.ownerId;
  }

  public vehiclesOwned(): Vehicle[] {
    return [];
  }

  public getOwner() {}
}
