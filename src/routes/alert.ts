import express from "express";
import { MotorqService } from "../services/motorq";

const router = express.Router();
const ms = new MotorqService();

router.post("/:alertId/resolve", async function (req: any, res: any) {
  try {
    const alertId = parseInt(req.params.alertId);

    if (isNaN(alertId)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }

    const resolved = await ms.resolveAlert(alertId);

    if (resolved) {
      res.json({ msg: "Alert resolved successfully", alertId });
    } else {
      res.status(404).json({ error: "Alert not found or already resolved" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

export default router;
