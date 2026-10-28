import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

export const SESSION_COOKIE = "pp_session";
export const CSRF_COOKIE = "pp_csrf";
export const CSRF_HEADER = "x-csrf-token";

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();

    if (!name) {
      continue;
    }

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }

  return cookies;
}

export function getCookie(request: Request, name: string): string | null {
  return parseCookies(request.headers.cookie)[name] ?? null;
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim();

    if (first) {
      return first.slice(0, 64);
    }
  }

  return request.ip ? request.ip.slice(0, 64) : null;
}

export function getUserAgent(request: Request): string | null {
  const value = request.headers["user-agent"];

  return typeof value === "string" ? value.slice(0, 512) : null;
}
