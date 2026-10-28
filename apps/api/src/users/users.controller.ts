import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import { CurrentAuth, Principal, Roles } from "../auth/auth.decorators.js";
import type { AuthActor } from "../auth/auth.types.js";
import { getClientIp, getUserAgent } from "../auth/cookies.js";
import {
  CreateBranchUserDto,
  InviteHeadOfficeDto,
  UpdateBranchesDto,
  UpdateRoleDto,
} from "./users.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("tenant-users")
@Principal("TENANT")
@Roles(UserRole.COMPANY_OWNER, UserRole.HEAD_OFFICE_ADMIN)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentAuth() actor: AuthActor) {
    return this.users.list(actor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createBranchUser(
    @CurrentAuth() actor: AuthActor,
    @Body() dto: CreateBranchUserDto,
    @Req() request: Request,
  ) {
    return this.users.createBranchUser(actor, dto, getClientIp(request), getUserAgent(request));
  }

  @Post("invitations/head-office")
  @HttpCode(HttpStatus.CREATED)
  inviteHeadOffice(
    @CurrentAuth() actor: AuthActor,
    @Body() dto: InviteHeadOfficeDto,
    @Req() request: Request,
  ) {
    return this.users.inviteHeadOffice(
      actor,
      dto.email,
      getClientIp(request),
      getUserAgent(request),
    );
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentAuth() actor: AuthActor,
    @Param("id", ParseUUIDPipe) userId: string,
    @Req() request: Request,
  ) {
    return this.users.deactivate(actor, userId, getClientIp(request), getUserAgent(request));
  }

  @Post(":id/reactivate")
  @HttpCode(HttpStatus.OK)
  reactivate(
    @CurrentAuth() actor: AuthActor,
    @Param("id", ParseUUIDPipe) userId: string,
    @Req() request: Request,
  ) {
    return this.users.reactivate(actor, userId, getClientIp(request), getUserAgent(request));
  }

  @Post(":id/reset-password")
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @CurrentAuth() actor: AuthActor,
    @Param("id", ParseUUIDPipe) userId: string,
    @Req() request: Request,
  ) {
    return this.users.resetPassword(actor, userId, getClientIp(request), getUserAgent(request));
  }

  @Put(":id/branches")
  updateBranches(
    @CurrentAuth() actor: AuthActor,
    @Param("id", ParseUUIDPipe) userId: string,
    @Body() dto: UpdateBranchesDto,
    @Req() request: Request,
  ) {
    return this.users.updateBranches(
      actor,
      userId,
      dto.branchIds,
      getClientIp(request),
      getUserAgent(request),
    );
  }

  @Put(":id/role")
  updateRole(
    @CurrentAuth() actor: AuthActor,
    @Param("id", ParseUUIDPipe) userId: string,
    @Body() dto: UpdateRoleDto,
    @Req() request: Request,
  ) {
    return this.users.updateRole(
      actor,
      userId,
      dto.role,
      getClientIp(request),
      getUserAgent(request),
    );
  }
}
