import type { components, operations, paths } from "./schema.js";

export type { components, operations, paths };
export type { components as ApiComponents, operations as ApiOperations, paths as ApiPaths };

export type LoginRequest = components["schemas"]["LoginDto"];
export type PlatformLoginRequest = components["schemas"]["PlatformLoginDto"];
export type MfaVerifyRequest = components["schemas"]["MfaVerifyDto"];
export type AcceptInvitationRequest = components["schemas"]["AcceptInvitationDto"];
export type CreateCompanyRequest = components["schemas"]["CreateCompanyDto"];
