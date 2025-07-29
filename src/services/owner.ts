import { Owner } from "../types/Owner";

class OwnerService {
  owner: Owner[];

  constructor() {
    this.owner = [];
  }

  addUser(owner: Owner) {
    this.owner.push(owner);
  }

  getUsers(ownerId: number) {
    this.owner.filter((owner) => {
      return owner.ownerId == ownerId;
    });
  }
}
