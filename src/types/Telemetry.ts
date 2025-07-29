type Coordinate = {
  x: number;
  y: number;
};

type EngineStatus = "On" | "Off" | "Idle";

interface TelemetryProps {
  gps: Coordinate;
  speed: number;
  engineStatus: EngineStatus;
}

export class Telemetry {
  gps: Coordinate;
  speed: number;
  engineStatus: EngineStatus;

  public constructor(tP: TelemetryProps) {
    this.gps = tP.gps;
    this.speed = tP.speed;
    this.engineStatus = tP.engineStatus;
  }
}
