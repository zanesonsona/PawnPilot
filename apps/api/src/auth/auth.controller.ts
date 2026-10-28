import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CurrentAuth, AllowPasswordChange, Public } from "./auth.decorators.js";
import {
  AcceptInvitationDto,
  ChangePasswordDto,
  LoginDto,
  MfaConfirmDto,
  MfaDisableDto,
  MfaEnrollmentConfirmDto,
  MfaEnrollmentStartDto,
  MfaVerifyDto,
  PasswordResetCompleteDto,
  PasswordResetRequestDto,
  PlatformLoginDto,
} from "./auth.dto.js";
import type { AuthActor, LoginResult } from "./auth.types.js";
import { AuthService } from "./auth.service.js";
import { getClientIp, getUserAgent } from "./cookies.js";
import { SessionService } from "./session.service.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.completeLogin(
      await this.auth.loginTenant(dto, getClientIp(request), getUserAgent(request)),
      response,
    );
  }

  @Public()
  @Post("platform/login")
  @HttpCode(HttpStatus.OK)
  async platformLogin(
    @Body() dto: PlatformLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.completeLogin(
      await this.auth.loginPlatform(dto, getClientIp(request), getUserAgent(request)),
      response,
    );
  }

  @Public()
  @Post("mfa/verify")
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.completeLogin(
      await this.auth.verifyMfa(
        dto.challengeToken,
        dto.code,
        getClientIp(request),
        getUserAgent(request),
      ),
      response,
    );
  }

  @Public()
  @Post("mfa/enroll")
  @HttpCode(HttpStatus.OK)
  async startPlatformMfaEnrollment(@Body() dto: MfaEnrollmentStartDto) {
    return this.auth.startPlatformMfaEnrollment(dto.challengeToken);
  }

  @Public()
  @Post("mfa/enroll/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmPlatformMfaEnrollment(
    @Body() dto: MfaEnrollmentConfirmDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.completeLogin(
      await this.auth.confirmPlatformMfaEnrollment(
        dto.challengeToken,
        dto.code,
        getClientIp(request),
        getUserAgent(request),
      ),
      response,
    );
  }

  @Public()
  @Post("accept-invitation")
  @HttpCode(HttpStatus.CREATED)
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.completeLogin(
      await this.auth.acceptInvitation(dto, getClientIp(request), getUserAgent(request)),
      response,
    );
  }

  @Public()
  @Post("password-reset/request")
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Req() request: Request) {
    await this.auth.requestPasswordReset(dto.email, getClientIp(request), getUserAgent(request));

    return { message: "If an account exists, a reset link has been sent." };
  }

  @Public()
  @Post("password-reset/complete")
  @HttpCode(HttpStatus.NO_CONTENT)
  async completePasswordReset(
    @Body() dto: PasswordResetCompleteDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.completePasswordReset(
      dto.token,
      dto.newPassword,
      getClientIp(request),
      getUserAgent(request),
    );
  }

  @Get("me")
  @AllowPasswordChange()
  async me(@CurrentAuth() actor: AuthActor) {
    return this.auth.getMe(actor);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowPasswordChange()
  async logout(
    @CurrentAuth() actor: AuthActor,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(actor, getClientIp(request), getUserAgent(request));
    this.sessions.clearCookies(response);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowPasswordChange()
  async changePassword(
    @CurrentAuth() actor: AuthActor,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.changePassword(
      actor,
      dto.currentPassword,
      dto.newPassword,
      getClientIp(request),
      getUserAgent(request),
    );
  }

  @Post("mfa/setup")
  async setupMfa(@CurrentAuth() actor: AuthActor) {
    return this.auth.setupMfa(actor);
  }

  @Post("mfa/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmMfa(
    @CurrentAuth() actor: AuthActor,
    @Body() dto: MfaConfirmDto,
    @Req() request: Request,
  ) {
    return this.auth.confirmMfa(actor, dto.code, getClientIp(request), getUserAgent(request));
  }

  @Post("mfa/disable")
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableMfa(
    @CurrentAuth() actor: AuthActor,
    @Body() dto: MfaDisableDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.disableMfa(
      actor,
      dto.currentPassword,
      dto.code,
      getClientIp(request),
      getUserAgent(request),
    );
  }

  private completeLogin(result: LoginResult, response: Response) {
    if (result.kind === "mfa") {
      return {
        mfaRequired: true,
        mfaSetupRequired: result.mfaSetupRequired ?? false,
        challengeToken: result.challengeToken,
        expiresAt: result.expiresAt,
      };
    }

    this.sessions.attachCookies(response, result.tokens);

    return {
      actor: result.actor,
      csrfToken: result.tokens.csrfToken,
      ...(result.recoveryCodes ? { recoveryCodes: result.recoveryCodes } : {}),
    };
  }
}
