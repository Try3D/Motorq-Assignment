import { Fleet } from "./Fleet";

interface OwnerProps {
  ownerId: number;
  name: string;
}

export class Owner {
  ownerId: number;
  name: string;

  public constructor(op: OwnerProps) {
    this.ownerId = op.ownerId;
    this.name = op.name;
  }

  public fleetsOwned(): Fleet[] {
    // return the list of fleets owned
    return [];
  }
}
