import { describe, expect, it } from "vitest";
import { getStatusLabel, type ServiceStatus } from "./status";

describe("getStatusLabel", () => {
  it.each<[ServiceStatus, string]>([
    ["checking", "Checking"],
    ["ready", "Ready"],
    ["degraded", "Degraded"],
    ["unavailable", "Unavailable"],
  ])("maps %s to %s", (status, label) => {
    expect(getStatusLabel(status)).toBe(label);
  });
});
