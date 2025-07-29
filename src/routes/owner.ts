import express from "express";
import { OwnerService } from "../services/ownerService";
import { Owner } from "../types/Owner";

const router = express.Router();
const ownerService = new OwnerService();

router.post("/add", async function (req: any, res: any) {
  try {
    const { ownerId, name } = req.body;

    if (await ownerService.addOwner(new Owner({ ownerId, name, fleets: [] }))) {
      res.json({ msg: "done" });
    } else {
      res.json({ msg: "Could not add it for some reason" });
    }
  } catch {
    res.json({ msg: "Pass the ownerId and name!" });
  }
});

router.get("/", async function (req: any, res: any) {
  try {
    const owners = await ownerService.getAllOwners();
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: "Failed to get owners" });
  }
});

router.get("/:ownerId", async function (req: any, res: any) {
  try {
    const ownerId = parseInt(req.params.ownerId);

    if (isNaN(ownerId)) {
      return res.status(400).json({ error: "Invalid owner ID" });
    }

    const owner = await ownerService.getOwner(ownerId);

    if (owner.error) {
      return res.status(404).json(owner);
    }

    res.json(owner);
  } catch (error) {
    res.status(500).json({ error: "Failed to get owner" });
  }
});

export default router;
