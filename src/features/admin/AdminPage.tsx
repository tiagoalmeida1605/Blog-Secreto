import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, MonitorCog, Palette, Radio, RotateCcw, ShieldCheck } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryState } from "../../components/feedback/QueryState";
import { api } from "../../services/api";
import { DASHBOARD_WIDGETS, INTEGRATION_MODULES, type DashboardWidget, type IntegrationModule } from "../../types/devhub";
import { useAuth } from "../auth/AuthProvider";

const widgetLabels: Record<DashboardWidget, string> = {
  integrations: "Estado das integrações",
  projects: "Projects",
  github: "GitHub Activity",
  deployments: "Deployments recentes",
  rga: "RGA Monitor",
};
const integrationLabels: Record<IntegrationModule, string> = {
  github: "GitHub Activity",
  vercel: "Vercel Monitor",
  rga: "RGA Monitor",
  firebase: "Firebase status",
};

export function AdminPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [theme, setTheme] = useState(readThemePreference);
  const [localError, setLocalError] = useState("");
  const update = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (value) => queryClient.setQueryData(["settings"], value),
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === "system" ? media.matches ? "light" : "dark" : theme;
    };
    applyTheme();
    if (theme === "system") media.addEventListener("change", applyTheme);
    try {
      localStorage.setItem("nexus-theme", theme);
      setLocalError("");
    } catch {
      setLocalError("O tema foi aplicado nesta sessão, mas não pôde ser salvo neste dispositivo.");
    }
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  async function toggleWidget(widget: DashboardWidget) {
    if (!settings.data) return;
    const dashboardWidgets = settings.data.dashboardWidgets.includes(widget)
      ? settings.data.dashboardWidgets.filter((value) => value !== widget)
      : [...settings.data.dashboardWidgets, widget];
    await update.mutateAsync({ ...settings.data, dashboardWidgets });
  }

  async function toggleIntegration(integration: IntegrationModule) {
    if (!settings.data) return;
    const visibleIntegrations = settings.data.visibleIntegrations.includes(integration)
      ? settings.data.visibleIntegrations.filter((value) => value !== integration)
      : [...settings.data.visibleIntegrations, integration];
    await update.mutateAsync({ ...settings.data, visibleIntegrations });
  }

  return (
    <>
      <PageHeader eyebrow="CONTROL PLANE / OWNER" title="Admin Center" description="Preferências não sensíveis do workspace, armazenadas no Firestore e validadas pelo backend." />
      <QueryState loading={settings.isLoading} error={settings.error as Error | null} onRetry={() => void settings.refetch()}>
        <div className="admin-sections">
          <section className="panel admin-panel">
            <header className="panel-heading"><div><p className="eyebrow">WORKSPACE / APPEARANCE</p><h2><Palette size={17} /> Aparência</h2></div></header>
            <p className="muted">O tema é salvo somente neste navegador. O modo escuro usa os tokens NEXUS BLUE.</p>
            <label className="form-control" htmlFor="theme-select">Tema</label><select id="theme-select" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="dark">NEXUS Blue Dark</option><option value="light">NEXUS Blue Light</option><option value="system">Sistema</option></select>
            {localError && <p className="inline-warning" role="status">{localError}</p>}
          </section>

          <section className="panel admin-panel">
            <header className="panel-heading"><div><p className="eyebrow">DASHBOARD / LAYOUT</p><h2><LayoutDashboard size={17} /> Widgets visíveis</h2></div></header>
            <p className="muted">Ative os módulos que deseja exibir no Dashboard. A preferência é sincronizada pelo backend autenticado.</p>
            <div className="settings-checklist">{DASHBOARD_WIDGETS.map((widget) => <ToggleRow key={widget} label={widgetLabels[widget]} checked={settings.data?.dashboardWidgets.includes(widget) ?? false} disabled={update.isPending} onChange={() => void toggleWidget(widget).catch(() => undefined)} />)}</div>
          </section>

          <section className="panel admin-panel">
            <header className="panel-heading"><div><p className="eyebrow">INTEGRATIONS / MODULES</p><h2><MonitorCog size={17} /> Módulos de integração</h2></div></header>
            <p className="muted">Controla quais integrações aparecem na navegação. Isso não altera credenciais nem desativa serviços no backend.</p>
            <div className="settings-checklist">{INTEGRATION_MODULES.map((integration) => <ToggleRow key={integration} label={integrationLabels[integration]} checked={settings.data?.visibleIntegrations.includes(integration) ?? false} disabled={update.isPending} onChange={() => void toggleIntegration(integration).catch(() => undefined)} />)}</div>
          </section>

          <section className="panel admin-panel">
            <header className="panel-heading"><div><p className="eyebrow">SECURITY / SESSION</p><h2><ShieldCheck size={17} /> Acesso e sessão</h2></div></header>
            <div className="security-details"><span><strong>Provedor</strong><small>Firebase Authentication</small></span><span><strong>Conta atual</strong><small>{user?.email || "Não disponível"}</small></span><span><strong>Validação de acesso</strong><small>Firebase Admin + UID proprietário em cada endpoint privado</small></span><span><strong>Tokens</strong><small>Somente em memória; não são armazenados pelo Dev Hub em Web Storage</small></span></div>
          </section>

          <section className="panel admin-panel">
            <header className="panel-heading"><div><p className="eyebrow">SYSTEM / APPLICATION</p><h2><Radio size={17} /> Runtime e configuração</h2></div></header>
            <div className="security-details"><span><strong>Produto</strong><small>NEXUS Dev Hub · v{import.meta.env.VITE_APP_VERSION || "3.0.0"}</small></span><span><strong>Frontend</strong><small>Vite + React + TypeScript</small></span><span><strong>Runtime Functions</strong><small>O manifesto declara Node.js 24.x; o runtime ativo não é exposto pela API.</small></span><span><strong>Secrets</strong><small>Gerenciados exclusivamente nas variáveis de ambiente da Vercel</small></span></div>
          </section>
        </div>
        {update.error && <p className="inline-error" role="alert">{update.error.message}</p>}
        {update.isSuccess && <p className="inline-success" role="status"><RotateCcw size={14} /> Preferências atualizadas.</p>}
      </QueryState>
    </>
  );
}

function readThemePreference() {
  try {
    const preference = localStorage.getItem("nexus-theme");
    return preference === "light" || preference === "system" ? preference : "dark";
  } catch {
    return "dark";
  }
}

function ToggleRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: () => void }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} /><span className="toggle-track" aria-hidden="true" /></label>;
}
