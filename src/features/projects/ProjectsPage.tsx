import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowUpRight, Boxes, ExternalLink, Pencil, Plus, Search, X } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { QueryState } from "../../components/feedback/QueryState";
import { api } from "../../services/api";
import type { DevHubProject, ProjectInput, ProjectStatus } from "../../types/devhub";

const emptyForm: ProjectInput = {
  name: "",
  description: "",
  category: "other",
  status: "active",
  repository: "",
  productionUrl: "",
  technologies: [],
};

const statusNames: Record<ProjectStatus, string> = {
  active: "Ativo",
  planned: "Planejado",
  paused: "Pausado",
  archived: "Arquivado",
};

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.getProjects });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<DevHubProject | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ProjectInput>(emptyForm);
  const [formError, setFormError] = useState("");

  const save = useMutation({
    mutationFn: async () => editing
      ? api.updateProject(editing.id, form)
      : api.createProject(form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditing(null);
      setCreating(false);
      setForm(emptyForm);
      setFormError("");
    },
    onError: (error) => setFormError(error.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => api.updateProject(id, { status: "archived" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const filtered = useMemo(() => (projects.data?.projects || []).filter((project) => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const matchesText = !normalized || `${project.name} ${project.description} ${project.category} ${project.technologies.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalized);
    return matchesText && (statusFilter === "all" || project.status === statusFilter);
  }), [projects.data, query, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setCreating(true);
  }

  function openEdit(project: DevHubProject) {
    setEditing(project);
    setForm({
      name: project.name,
      description: project.description,
      category: project.category,
      status: project.status,
      repository: project.repository,
      productionUrl: project.productionUrl,
      technologies: project.technologies,
    });
    setFormError("");
    setCreating(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    void save.mutateAsync().catch(() => undefined);
  }

  function closeForm() {
    if (save.isPending) return;
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
  }

  const activeCount = projects.data?.projects.filter((project) => project.status !== "archived").length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="PORTFOLIO / REGISTRY"
        title="Projects"
        description={`${activeCount} projeto${activeCount === 1 ? "" : "s"} ativo${activeCount === 1 ? "" : "s"} cadastrado${activeCount === 1 ? "" : "s"} no workspace.`}
        action={<button className="button button-primary" type="button" onClick={openCreate}><Plus size={16} /> Novo projeto</button>}
      />
      <div className="toolbar">
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projetos..." /><span className="sr-only">Buscar projetos</span></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por estado">
          <option value="all">Todos os estados</option><option value="active">Ativos</option><option value="planned">Planejados</option><option value="paused">Pausados</option><option value="archived">Arquivados</option>
        </select>
      </div>
      {archive.error && <p className="inline-error" role="alert">{archive.error.message}</p>}
      <QueryState loading={projects.isLoading} error={projects.error as Error | null} onRetry={() => void projects.refetch()}>
        {filtered.length ? (
          <section className="project-grid" aria-label="Lista de projetos">
            {filtered.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-card-top"><span className={`project-icon status-dot-${project.status}`}><Boxes size={18} /></span><span className={`project-status status-${project.status}`}>{statusNames[project.status]}</span></div>
                <p className="eyebrow">{project.category}</p><h2>{project.name}</h2>
                <p className="project-description">{project.description || "Sem descrição cadastrada."}</p>
                <div className="technology-list">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>
                <div className="project-links">
                  {project.repository && <a href={`https://github.com/${project.repository}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Repositório</a>}
                  {project.productionUrl && <a href={project.productionUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={14} /> Produção</a>}
                </div>
                <footer className="project-card-footer">
                  <span>Atualizado {formatDate(project.updatedAt)}</span>
                  <span className="project-actions">
                    <button className="icon-button" type="button" onClick={() => openEdit(project)} aria-label={`Editar ${project.name}`}><Pencil size={15} /></button>
                    {project.status !== "archived" && <button className="icon-button" type="button" onClick={() => archive.mutate(project.id)} disabled={archive.isPending} aria-label={`Arquivar ${project.name}`}><Archive size={15} /></button>}
                  </span>
                </footer>
              </article>
            ))}
          </section>
        ) : <div className="empty-state"><Boxes size={22} /><h2>{projects.data?.projects.length ? "Nenhum resultado" : "Projects começa aqui"}</h2><p>{projects.data?.projects.length ? "Ajuste a busca ou o filtro para ver outros projetos." : "Cadastre projetos para acompanhar seus metadados e associações."}</p>{!projects.data?.projects.length && <button className="button button-primary" onClick={openCreate} type="button"><Plus size={15} /> Cadastrar projeto</button>}</div>}
      </QueryState>

      {creating && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
            <header><div><p className="eyebrow">PROJECT REGISTRY</p><h2 id="project-form-title">{editing ? "Editar projeto" : "Novo projeto"}</h2></div><button className="icon-button" type="button" onClick={closeForm} aria-label="Fechar formulário"><X size={18} /></button></header>
            <form className="form-stack project-form" onSubmit={submit}>
              <label htmlFor="project-name">Nome *</label><input id="project-name" maxLength={120} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <label htmlFor="project-description">Descrição</label><textarea id="project-description" rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              <div className="form-grid">
                <div><label htmlFor="project-category">Categoria</label><input id="project-category" maxLength={60} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></div>
                <div><label htmlFor="project-status">Estado</label><select id="project-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })}><option value="active">Ativo</option><option value="planned">Planejado</option><option value="paused">Pausado</option><option value="archived">Arquivado</option></select></div>
              </div>
              <label htmlFor="project-repository">Repositório GitHub <small>owner/repo</small></label><input id="project-repository" placeholder="owner/repository" value={form.repository} onChange={(event) => setForm({ ...form, repository: event.target.value })} />
              <label htmlFor="project-url">URL publicada</label><input id="project-url" type="url" placeholder="https://" value={form.productionUrl} onChange={(event) => setForm({ ...form, productionUrl: event.target.value })} />
              <label htmlFor="project-technologies">Tecnologias <small>separadas por vírgula</small></label><input id="project-technologies" value={form.technologies.join(", ")} onChange={(event) => setForm({ ...form, technologies: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
              {formError && <p className="inline-error" role="alert">{formError}</p>}
              <div className="dialog-actions"><button className="button button-quiet" onClick={closeForm} type="button">Cancelar</button><button className="button button-primary" disabled={save.isPending} type="submit">{save.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar projeto"}</button></div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "data indisponível" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}
