type AlertType =
  | "Speed Violation"
  | "Low Fuel"
  | "Engine Status"
  | "Maintenance";
type AlertSeverity = "Critical" | "Warning" | "Info";

interface AlertProps {
  id?: number;
  vehicleVin: number;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  thresholdValue?: number;
  actualValue?: number;
  isResolved?: boolean;
  triggeredAt: Date;
  resolvedAt?: Date;
}

export class Alert {
  id?: number;
  vehicleVin: number;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  thresholdValue?: number;
  actualValue?: number;
  isResolved: boolean;
  triggeredAt: Date;
  resolvedAt?: Date;

  constructor(props: AlertProps) {
    this.id = props.id;
    this.vehicleVin = props.vehicleVin;
    this.alertType = props.alertType;
    this.severity = props.severity;
    this.message = props.message;
    this.thresholdValue = props.thresholdValue;
    this.actualValue = props.actualValue;
    this.isResolved = props.isResolved || false;
    this.triggeredAt = props.triggeredAt;
    this.resolvedAt = props.resolvedAt;
  }
}

export type { AlertType, AlertSeverity };
