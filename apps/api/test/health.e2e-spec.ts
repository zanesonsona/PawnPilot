import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";

describe("PawnPilot API (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health/live returns liveness", async () => {
    const response = await request(app.getHttpServer()).get("/health/live").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      service: "pawnpilot-api",
    });
  });

  it("GET /health/ready checks PostgreSQL", async () => {
    const response = await request(app.getHttpServer()).get("/health/ready").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      checks: {
        database: "up",
      },
    });
  });

  it("GET /api/v1 returns API metadata", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1").expect(200);

    expect(response.body).toMatchObject({
      name: "PawnPilot API",
      version: "1.0.0",
    });
  });
});
