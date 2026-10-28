import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import type { AuthenticatedRequest, PrincipalType } from "./auth.types.js";

export const IS_PUBLIC_KEY = "auth:isPublic";
export const PRINCIPAL_KEY = "auth:principal";
export const ROLES_KEY = "auth:roles";
export const ALLOW_PASSWORD_CHANGE_KEY = "auth:allowPasswordChange";

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Principal = (principal: PrincipalType) => SetMetadata(PRINCIPAL_KEY, principal);

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const AllowPasswordChange = () => SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);

export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

  return request.auth;
});
