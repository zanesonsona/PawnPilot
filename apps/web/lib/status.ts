export type ServiceStatus = "checking" | "ready" | "degraded" | "unavailable";

export function getStatusLabel(status: ServiceStatus): string {
  switch (status) {
    case "checking":
      return "Checking";
    case "ready":
      return "Ready";
    case "degraded":
      return "Degraded";
    case "unavailable":
      return "Unavailable";
  }
}
