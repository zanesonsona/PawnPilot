import { Controller, Get, Version } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "./auth/auth.decorators.js";

@ApiTags("meta")
@Public()
@Controller()
export class AppController {
  @Get()
  @Version("1")
  @ApiOperation({ summary: "API metadata" })
  getRoot() {
    return {
      name: "PawnPilot API",
      version: "1.0.0",
      status: "ok",
    };
  }
}
