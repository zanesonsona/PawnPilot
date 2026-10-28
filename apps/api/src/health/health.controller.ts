import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/auth.decorators.js";
import { PrismaService } from "../prisma/prisma.service.js";

@ApiTags("health")
@Public()
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  live() {
    return {
      status: "ok",
      service: "pawnpilot-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe including database connectivity" })
  async ready() {
    try {
      await this.prisma.ping();

      return {
        status: "ok",
        checks: {
          database: "up",
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        checks: {
          database: "down",
        },
      });
    }
  }
}
