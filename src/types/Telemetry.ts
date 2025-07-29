type Coordinate = {
  x: number;
  y: number;
};

type EngineStatus = "On" | "Off" | "Idle";

interface TelemetryProps {
  gps: Coordinate;
  speed: number;
  engineStatus: EngineStatus;
  fuel: number;
  totalKm: number;
  timeStamp: Date;
}

export class Telemetry {
  gps: Coordinate;
  speed: number;
  engineStatus: EngineStatus;
  fuel: number;
  totalKm: number;
  timeStamp: Date;

  public constructor(tP: TelemetryProps) {
    this.gps = tP.gps;
    this.speed = tP.speed;
    this.engineStatus = tP.engineStatus;
    this.fuel = tP.fuel;
    this.totalKm = tP.totalKm;
    this.timeStamp = tP.timeStamp;
  }
}
