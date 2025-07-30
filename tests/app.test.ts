import request from "supertest";
import express from "express";

const createTestApp = () => {
  const app = express();
  app.use(express.json());

  app.get("/", (req, res) => {
    res.send("Hello, world!");
  });

  return app;
};

describe("GET /", () => {
  it("should return Hello, world!", async () => {
    const app = createTestApp();
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe("Hello, world!");
  });
});
