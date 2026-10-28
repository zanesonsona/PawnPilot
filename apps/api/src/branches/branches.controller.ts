import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import { CurrentAuth, Principal, Roles } from "../auth/auth.decorators.js";
import type { AuthActor } from "../auth/auth.types.js";
import { getClientIp, getUserAgent } from "../auth/cookies.js";
import { CreateBranchDto, UpdateBranchDto } from "./branches.dto.js";
import { BranchesService } from "./branches.service.js";

@ApiTags("tenant-branches")
@Principal("TENANT")
@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @Roles(UserRole.COMPANY_OWNER, UserRole.HEAD_OFFICE_ADMIN, UserRole.BRANCH_OPERATOR)
  list(@CurrentAuth() actor: AuthActor) {
    return this.branches.list(actor);
  }

  @Get(":id")
  @Roles(UserRole.COMPANY_OWNER, UserRole.HEAD_OFFICE_ADMIN, UserRole.BRANCH_OPERATOR)
  get(@CurrentAuth() actor: AuthActor, @Param("id", ParseUUIDPipe) id: string) {
    return this.branches.get(actor, id);
  }

  @Post()
  @Roles(UserRole.COMPANY_OWNER)
  create(@CurrentAuth() actor: AuthActor, @Body() dto: CreateBranchDto, @Req() request: Request) {
    return this.branches.create(actor, dto, getClientIp(request), getUserAgent(request));
  }

  @Patch(":id")
  @Roles(UserRole.COMPANY_OWNER)
  update(
    @CurrentAuth() actor: AuthActor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @Req() request: Request,
  ) {
    return this.branches.update(actor, id, dto, getClientIp(request), getUserAgent(request));
  }
}
