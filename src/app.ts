import express from "express";

import { MotorqService } from "./services/motorq";
import { Owner } from "./types/Owner";

const ms = new MotorqService({
  owners: [],
});

const app = express();

app.post("/owners/add", function (req: any, res: any) {
  const { ownerId, name } = req.body;

  ms.addOwner(new Owner({ ownerId, name, fleets: [] }));
});

export default app;
