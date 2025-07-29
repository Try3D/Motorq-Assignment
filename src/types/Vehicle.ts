type Manufacturer = "Tesla" | "BMW" | "Ford" | "Toyota";

type RegistrationStatus = "Active" | "Maintanance" | "Decommissioned";

interface VehicleProps {
  vin: number;
  manufacturer: Manufacturer;
  fleetId: number;
  registrationStatus: RegistrationStatus;
}

export abstract class Vehicle {
  vin: number;
  manufacturer: Manufacturer;
  fleetId: number;
  registrationStatus: RegistrationStatus;

  public constructor(vP: VehicleProps) {
    this.vin = vP.vin;
    this.manufacturer = vP.manufacturer;
    this.fleetId = vP.fleetId;
    this.registrationStatus = vP.registrationStatus;
  }
}
