import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor, PlatformCompany } from "./types.js";

const apiBaseUrl = (process.env.API_INTERNAL_URL ?? "http://localhost:3001").replace(/\/$/u, "");

async function cookieHeader(): Promise<string> {
  const store = await cookies();

  return store
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

export async function apiServerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookie = await cookieHeader();

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...init.headers,
      ...(cookie ? { cookie } : {}),
    },
    cache: "no-store",
  });
}

export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  try {
    const response = await apiServerFetch("/api/v1/auth/me");

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Actor;
  } catch {
    return null;
  }
});

export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();

  if (!actor) {
    redirect("/login");
  }

  return actor;
}

export async function getPlatformCompanies(): Promise<{
  companies: PlatformCompany[];
  error: string | null;
}> {
  try {
    const response = await apiServerFetch("/api/v1/platform/companies");

    if (!response.ok) {
      return {
        companies: [],
        error: "The platform register could not be loaded. Refresh to try again.",
      };
    }

    return {
      companies: (await response.json()) as PlatformCompany[],
      error: null,
    };
  } catch {
    return {
      companies: [],
      error: "The platform register could not be loaded. Refresh to try again.",
    };
  }
}
