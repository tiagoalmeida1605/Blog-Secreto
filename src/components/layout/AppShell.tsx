import { useState } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Code2,
  Command,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  FlaskConical,
  Radio,
  Settings2,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../features/auth/AuthProvider";
import { api } from "../../services/api";
import { StateBadge } from "../feedback/StateBadge";
import { BrandLogo } from "../BrandLogo";
import { INTEGRATION_MODULES, type IntegrationModule } from "../../types/devhub";

const navigation = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/projects", label: "Projects", icon: Boxes },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/integrations", label: "Integrations", icon: Zap },
  { to: "/github", label: "GitHub Activity", icon: GitBranch, integration: "github" },
  { to: "/vercel", label: "Vercel Monitor", icon: Activity, integration: "vercel" },
  { to: "/rga", label: "RGA Monitor", icon: Radio, integration: "rga" },
  { to: "/admin", label: "Admin Center", icon: Settings2 },
  { to: "/system", label: "System Monitor", icon: Code2 },
];

const sectionNames = Object.fromEntries(navigation.map(({ to, label }) => [to, label]));

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.getOverview });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings, enabled: Boolean(user) });
  const sectionName = sectionNames[location.pathname] || "Dashboard";
  const initials = (user?.displayName || user?.email || "OW").slice(0, 2).toUpperCase();
  const visibleIntegrations = settings.data?.visibleIntegrations || [...INTEGRATION_MODULES];
  const visibleNavigation = navigation.filter(({ integration }) => !integration || visibleIntegrations.includes(integration as IntegrationModule));

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " mobile-nav-open" : ""}`}>
      {mobileOpen && <button className="mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação" />}
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="sidebar-top">
          <NavLink className="brand-lockup" to="/" onClick={() => setMobileOpen(false)} aria-label="NEXUS Dev Hub — Dashboard">
            <BrandLogo layout={collapsed ? "symbol" : "horizontal"} width={collapsed ? 40 : 205} alt="NEXUS Dev Hub" />
          </NavLink>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação"><X size={18} /></button>
        </div>
        <div className="workspace-label"><span>WORKSPACE</span><span className="online-indicator" title="Sessão autenticada" /></div>
        <nav className="side-nav">
          {visibleNavigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
          <div className="roadmap-nav" aria-label="Áreas planejadas para o futuro">
            <p className="workspace-label">ROADMAP</p>
            <div className="roadmap-nav-item"><Code2 size={16} /><span>Development Log</span><small>FUTURE</small></div>
            <div className="roadmap-nav-item"><FlaskConical size={16} /><span>Idea Lab</span><small>FUTURE</small></div>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-system">
            <div className="sidebar-system-title"><ShieldCheck size={15} /><span>System status</span></div>
            {overview.data ? <StateBadge state={overview.data.overallState} /> : <span className="muted small-text">{overview.isLoading ? "Verificando fontes..." : "Estado indisponível"}</span>}
          </div>
          <div className="sidebar-user">
            <span className="user-avatar">{initials}</span>
            <span className="user-data"><strong>{user?.displayName || "Proprietário"}</strong><small>{user?.email}</small></span>
            <button className="icon-button logout-icon" title="Sair da sessão" onClick={() => void logout()} aria-label="Sair da sessão"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir navegação"><Menu size={19} /></button>
          <div className="breadcrumb"><span>NEXUS</span><ChevronRight size={14} /><strong>{sectionName}</strong></div>
          <div className="topbar-right">
            {overview.data && <StateBadge state={overview.data.overallState} />}
            <span className="topbar-divider" />
            <span className="topbar-private"><ShieldCheck size={15} /> PRIVATE</span>
            <NavLink to="/admin" className="icon-button topbar-settings" aria-label="Configurações"><Command size={17} /></NavLink>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
        <footer className="app-footer"><span>NEXUS DEV HUB <span className="mono">/ PRIVATE WORKSPACE</span></span><span className="footer-runtime">FIREBASE AUTH · OWNER ACCESS</span></footer>
      </div>
      <button
        className="sidebar-collapse"
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>
    </div>
  );
}
