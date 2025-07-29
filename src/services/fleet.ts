import { Fleet } from "../types/Fleet";

class FleetService {
  fleets: Fleet[];

  constructor(fleets: Fleet[]) {
    this.fleets = fleets;
  }
}
