import { Fleet } from "./Fleet";

interface OwnerProps {
  ownerId: number;
  name: string;
  fleets: Fleet[];
}

export class Owner {
  ownerId: number;
  name: string;
  fleets: Fleet[];

  public constructor(op: OwnerProps) {
    this.ownerId = op.ownerId;
    this.name = op.name;
    this.fleets = op.fleets;
  }

  public fleetsOwned(): Fleet[] {
    return this.fleets;
  }
}
