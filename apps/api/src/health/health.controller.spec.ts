import { ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  let controller: HealthController;
  const prisma = {
    ping: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it("returns a liveness response", () => {
    expect(controller.live()).toMatchObject({
      status: "ok",
      service: "pawnpilot-api",
    });
  });

  it("returns ready when the database responds", async () => {
    prisma.ping.mockResolvedValue(undefined);

    await expect(controller.ready()).resolves.toMatchObject({
      status: "ok",
      checks: {
        database: "up",
      },
    });
  });

  it("returns a service unavailable error when the database fails", async () => {
    prisma.ping.mockRejectedValue(new Error("database unavailable"));

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
