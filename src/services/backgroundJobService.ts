import { AlertComputationService } from "./alertComputationService";

export class BackgroundJobService {
  private alertComputationService: AlertComputationService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.alertComputationService = new AlertComputationService();
  }

  start(): void {
    if (this.isRunning) {
      console.log("⚠️ Background job service is already running");
      return;
    }

    console.log("🚀 Starting background job service - Alert computation every 30 seconds");
    
    // Run immediately on start
    this.alertComputationService.computeAndStoreAlerts();

    // Then run every 30 seconds
    this.intervalId = setInterval(async () => {
      try {
        await this.alertComputationService.computeAndStoreAlerts();
      } catch (error) {
        console.error("❌ Error in background alert computation:", error);
      }
    }, 30000); // 30 seconds

    this.isRunning = true;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("🛑 Background job service stopped");
  }

  getStatus(): { isRunning: boolean; intervalSeconds: number } {
    return {
      isRunning: this.isRunning,
      intervalSeconds: 30,
    };
  }
}
