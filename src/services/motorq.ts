import { Owner } from "../types/Owner";

interface MotorqProps {
  owners: Owner[];
}

export class MotorqService {
  owners: Owner[];

  public constructor(mp: MotorqProps) {
    this.owners = mp.owners;
  }

  addOwner(owner: Owner) {
    this.owners.push(owner);
  }
}
