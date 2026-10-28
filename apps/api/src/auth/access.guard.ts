import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { UserRole } from "@prisma/client";
import {
  ALLOW_PASSWORD_CHANGE_KEY,
  IS_PUBLIC_KEY,
  PRINCIPAL_KEY,
  ROLES_KEY,
} from "./auth.decorators.js";
import type { AuthenticatedRequest, PrincipalType } from "./auth.types.js";
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, getCookie, safeEqual } from "./cookies.js";
import { SessionService } from "./session.service.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class AccessGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    config: ConfigService,
  ) {
    this.allowedOrigins = new Set(
      (config.get<string>("WEB_ORIGIN") ?? "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/u, ""))
        .filter(Boolean),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const origin = request.headers.origin;

    if (
      !SAFE_METHODS.has(request.method) &&
      origin &&
      !this.allowedOrigins.has(origin.replace(/\/$/u, ""))
    ) {
      throw new ForbiddenException({
        code: "ORIGIN_NOT_ALLOWED",
        message: "The request origin is not allowed.",
      });
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const sessionToken = getCookie(request, SESSION_COOKIE);

    if (!sessionToken) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
    }

    const actor = await this.sessions.resolve(sessionToken);

    if (!actor) {
      throw new UnauthorizedException({
        code: "SESSION_REVOKED",
        message: "Your session is no longer valid. Please sign in again.",
      });
    }

    request.auth = actor;

    const principal = this.reflector.getAllAndOverride<PrincipalType>(PRINCIPAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (principal === "PLATFORM" && actor.type !== "PLATFORM_ADMIN") {
      throw new ForbiddenException({
        code: "PLATFORM_ACCESS_REQUIRED",
        message: "This endpoint is only available to platform administrators.",
      });
    }

    if (principal === "TENANT" && actor.type !== "TENANT_USER") {
      throw new ForbiddenException({
        code: "TENANT_ACCESS_REQUIRED",
        message: "This endpoint is only available to tenant users.",
      });
    }

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (roles?.length) {
      if (!actor.user || !roles.includes(actor.user.role)) {
        throw new ForbiddenException({
          code: "ROLE_REQUIRED",
          message: "You do not have permission to perform this action.",
        });
      }
    }

    const allowPasswordChange = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (actor.mustChangePassword && !allowPasswordChange) {
      throw new ForbiddenException({
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "You must change your temporary password before continuing.",
      });
    }

    if (!SAFE_METHODS.has(request.method)) {
      const header = request.headers[CSRF_HEADER];
      const cookie = getCookie(request, CSRF_COOKIE);

      if (typeof header !== "string" || !cookie || !safeEqual(header, cookie)) {
        throw new ForbiddenException({
          code: "CSRF_FAILED",
          message: "The request could not be verified. Refresh and try again.",
        });
      }
    }

    return true;
  }
}
