import type { ApiErrorBody } from "./types.js";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

export function csrfToken(): string {
  return readCookie("pp_csrf") ?? "";
}

export async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  options: { csrf?: boolean } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };

  if (options.csrf) {
    const token = csrfToken();

    if (token) {
      headers["x-csrf-token"] = token;
    }
  }

  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "same-origin",
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? ((await response.json()) as T) : null;

  return { ok: response.ok, status: response.status, data };
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const error = (payload as ApiErrorBody).error;

  if (!error) {
    return fallback;
  }

  if (typeof error.details === "string") {
    return error.details;
  }

  if (Array.isArray(error.details) && typeof error.details[0] === "string") {
    return error.details[0];
  }

  return error.message ?? fallback;
}
