import { MotorqService } from "./motorq";
import { Owner } from "../types/Owner";

export class OwnerService {
  private motorqService: MotorqService;

  constructor() {
    this.motorqService = new MotorqService();
  }

  async addOwner(owner: Owner): Promise<boolean> {
    return await this.motorqService.addOwner(owner);
  }

  async getAllOwners(): Promise<any> {
    const data = await this.motorqService.getAllData();
    return { owners: data.owners };
  }

  async getOwner(ownerId: number): Promise<any> {
    const data = await this.motorqService.getAllData();
    const owner = data.owners.find((o: any) => o.ownerId === ownerId);
    
    if (!owner) {
      return { error: "Owner not found" };
    }
    
    return owner;
  }
}
