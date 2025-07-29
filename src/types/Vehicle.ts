import { Telemetry } from "./Telemetry";

type Manufacturer = "Tesla" | "BMW" | "Ford" | "Toyota";

type RegistrationStatus = "Active" | "Maintanance" | "Decommissioned";

interface VehicleProps {
  vin: number;
  manufacturer: Manufacturer;
  fleetId: number;
  registrationStatus: RegistrationStatus;
  telemetryData: Telemetry[];
}

export class Vehicle {
  vin: number;
  manufacturer: Manufacturer;
  fleetId: number;
  registrationStatus: RegistrationStatus;
  telemetryData: Telemetry[];

  public constructor(vP: VehicleProps) {
    this.vin = vP.vin;
    this.manufacturer = vP.manufacturer;
    this.fleetId = vP.fleetId;
    this.registrationStatus = vP.registrationStatus;
    this.telemetryData = vP.telemetryData;
  }

  public getTelemetry() {}
}
