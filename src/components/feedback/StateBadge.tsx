import { Check, CircleAlert, CircleDashed, CircleOff, type LucideIcon } from "lucide-react";
import type { IntegrationState } from "../../types/devhub";

const labels: Record<IntegrationState, string> = {
  operational: "Operacional",
  degraded: "Degradado",
  unavailable: "Indisponível",
  partially_configured: "Configuração parcial",
};

const icons: Record<IntegrationState, LucideIcon> = {
  operational: Check,
  degraded: CircleAlert,
  unavailable: CircleOff,
  partially_configured: CircleDashed,
};

export function StateBadge({ state }: { state: IntegrationState | string }) {
  const safeState = state in labels ? state as IntegrationState : "unavailable";
  const Icon = icons[safeState];
  return <span className={`state-badge state-${safeState}`}><Icon size={13} />{labels[safeState]}</span>;
}
