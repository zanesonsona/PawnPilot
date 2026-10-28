import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentAuth, Principal } from "../auth/auth.decorators.js";
import type { AuthActor } from "../auth/auth.types.js";
import { getClientIp, getUserAgent } from "../auth/cookies.js";
import { CreateCompanyDto, CreateOwnerInvitationDto } from "./platform.dto.js";
import { PlatformService } from "./platform.service.js";

@ApiTags("platform")
@Principal("PLATFORM")
@Controller("platform")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("companies")
  listCompanies() {
    return this.platform.listCompanies();
  }

  @Post("companies")
  @HttpCode(HttpStatus.CREATED)
  createCompany(
    @CurrentAuth() actor: AuthActor,
    @Body() dto: CreateCompanyDto,
    @Req() request: Request,
  ) {
    return this.platform.createCompany(actor, dto, getClientIp(request), getUserAgent(request));
  }

  @Post("companies/:companyId/owner-invitations")
  @HttpCode(HttpStatus.CREATED)
  createOwnerInvitation(
    @CurrentAuth() actor: AuthActor,
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Body() dto: CreateOwnerInvitationDto,
    @Req() request: Request,
  ) {
    return this.platform.createOwnerInvitation(
      actor,
      companyId,
      dto.email,
      getClientIp(request),
      getUserAgent(request),
    );
  }
}
