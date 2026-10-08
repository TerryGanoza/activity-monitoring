"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  calculateProjectProgress,
  calculateTeamMemberProgress,
  createId,
} from "@/lib/workspace";
import type { LogEntry, Project, Requirement, TeamMember, WorkspaceData } from "@/lib/workspace";

type IconName =
  | "activity"
  | "arrow"
  | "bell"
  | "briefcase"
  | "calendar"
  | "chart"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "edit"
  | "email"
  | "grid"
  | "lock"
  | "logout"
  | "menu"
  | "plus"
  | "search"
  | "team"
  | "trash"
  | "user";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15z" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    team: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const emptyWorkspace: WorkspaceData = {
  members: [],
  projects: [],
  logEntries: [],
  requirements: [],
  requirementLogs: [],
};

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function progressPath(values: number[]) {
  if (!values.length) return "";
  const width = 620;
  const top = 12;
  const height = 164;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = top + ((100 - value) / 100) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function TeamAvatar({ member, large = false }: { member: TeamMember; large?: boolean }) {
  return (
    <span className={`avatar avatar-${member.color}${large ? " avatar-large" : ""}`}>
      {member.initials || initialsFromName(member.name)}
    </span>
  );
}

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceData>(emptyWorkspace);
  const [activePage, setActivePage] = useState<"dashboard" | "team" | "projects">("dashboard");
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loginEmail, setLoginEmail] = useState(
    process.env.NODE_ENV === "production" ? "" : "admin@bcp.local",
  );
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");
  const [memberModal, setMemberModal] = useState<TeamMember | "new" | null>(null);
  const [projectModal, setProjectModal] = useState<Project | "new" | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const refreshWorkspace = useCallback(async () => {
    const response = await fetch("/api/workspace");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo cargar la información.");
    setWorkspace(data as WorkspaceData);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) throw new Error("No se pudo comprobar la sesión.");
        const session = (await response.json()) as { email: string | null };
        if (!session.email) return;
        if (!cancelled) {
          setUserEmail(session.email);
          await refreshWorkspace();
        }
      } catch {
        if (!cancelled) setError("No pudimos conectar con la base de datos local.");
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [refreshWorkspace]);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return workspace.members;
    return workspace.members.filter((member) =>
      `${member.name} ${member.role} ${member.area} ${member.project}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [search, workspace.members]);

  const activeMembers = workspace.members.filter((member) => member.status === "Activo").length;
  const inProgressProjects = workspace.projects.filter((project) => project.status === "En curso").length;
  const averageProgress = workspace.projects.length
    ? Math.round(
        workspace.projects.reduce((total, project) => total + project.progress, 0) /
          workspace.projects.length,
      )
    : 0;

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBooting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo iniciar sesión.");
      setUserEmail(data.email);
      await refreshWorkspace();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
    } finally {
      setBooting(false);
    }
  }

  async function handleLogout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("No se pudo cerrar la sesión.");
      setUserEmail("");
      setWorkspace(emptyWorkspace);
      setLoginPassword("");
      setActivePage("dashboard");
    } catch {
      setError("No se pudo cerrar la sesión. Inténtalo nuevamente.");
    }
  }

  async function persistWorkspace(nextWorkspace: WorkspaceData, closeEditor = true) {
    setSaving(true);
    setError("");
    try {
      const workspaceWithCalculatedProgress = {
        ...nextWorkspace,
        members: nextWorkspace.members.map((member) => ({
          ...member,
          progress: calculateTeamMemberProgress(nextWorkspace.requirements, member.id),
        })),
        projects: nextWorkspace.projects.map((project) => ({
          ...project,
          progress: calculateProjectProgress(
            nextWorkspace.requirements.filter((requirement) => requirement.projectId === project.id),
          ),
        })),
      };
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspaceWithCalculatedProgress),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudieron guardar los cambios.");
      setWorkspace(workspaceWithCalculatedProgress);
      setNotice("Cambios guardados correctamente");
      window.setTimeout(() => setNotice(""), 3200);
      if (closeEditor) {
        setMemberModal(null);
        setProjectModal(null);
      }
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los cambios.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function saveMember(member: TeamMember) {
    const members = workspace.members.some((item) => item.id === member.id)
      ? workspace.members.map((item) => (item.id === member.id ? member : item))
      : [member, ...workspace.members];
    void persistWorkspace({ ...workspace, members });
  }

  function saveProject(project: Project) {
    const previousProject = workspace.projects.find((item) => item.id === project.id);
    const projects = previousProject
      ? workspace.projects.map((item) => (item.id === project.id ? project : item))
      : [project, ...workspace.projects];
    const members = previousProject && previousProject.name !== project.name
      ? workspace.members.map((member) =>
          member.project === previousProject.name ? { ...member, project: project.name } : member,
        )
      : workspace.members;
    void persistWorkspace({ ...workspace, members, projects });
  }

  function deleteProject(project: Project) {
    const projectRequirements = workspace.requirements.filter(
      (requirement) => requirement.projectId === project.id,
    );
    const requirementIds = new Set(projectRequirements.map((requirement) => requirement.id));
    const linkedLogCount = workspace.requirementLogs.filter((entry) =>
      requirementIds.has(entry.requirementId),
    ).length;
    const linkedDataMessage = projectRequirements.length
      ? ` También se eliminarán ${projectRequirements.length} requerimiento(s) y ${linkedLogCount} avance(s) asociado(s).`
      : "";
    if (!window.confirm(`¿Eliminar el proyecto «${project.name}»?${linkedDataMessage} Esta acción no se puede deshacer.`)) {
      return;
    }

    void persistWorkspace({
      ...workspace,
      members: workspace.members.map((member) =>
        member.project === project.name ? { ...member, project: "" } : member,
      ),
      projects: workspace.projects.filter((item) => item.id !== project.id),
      requirements: workspace.requirements.filter((item) => item.projectId !== project.id),
      requirementLogs: workspace.requirementLogs.filter(
        (entry) => !requirementIds.has(entry.requirementId),
      ),
    }, false);
  }

  if (booting) {
    return (
      <main className="startup-screen">
        <div className="brand-mark"><span>B</span></div>
        <span className="loading-dots">Preparando tu espacio de trabajo</span>
      </main>
    );
  }

  if (!userEmail) {
    return (
      <main className="login-screen">
        <div className="login-decoration login-decoration-one" />
        <div className="login-decoration login-decoration-two" />
        <section className="login-panel">
          <Link className="brand-lockup" href="/" aria-label="BCP Seguimiento, inicio">
            <span className="brand-mark"><span>B</span></span>
            <span className="brand-wordmark">bcp<span>.</span></span>
          </Link>
          <div className="login-copy">
            <span className="eyebrow">BITÁCORA DE SEGUIMIENTO</span>
            <h1>El progreso de tu equipo,<br /><span>en un solo lugar.</span></h1>
            <p>Conecta con tus proyectos, acompaña a tu equipo y avancen juntos.</p>
          </div>
          <div className="login-art" aria-hidden="true">
            <div className="art-orbit art-orbit-one" />
            <div className="art-orbit art-orbit-two" />
            <div className="art-sun" />
            <div className="art-bars"><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="art-card"><span /><span /><span /></div>
            <div className="art-dot art-dot-one" /><div className="art-dot art-dot-two" />
          </div>
          <div className="login-footer"><span>Seguimiento claro. Equipos que avanzan.</span><span>© 2026</span></div>
        </section>
        <section className="login-form-panel">
          <div className="login-form-wrap">
            <div className="mobile-brand brand-lockup">
              <span className="brand-mark"><span>B</span></span><span className="brand-wordmark">bcp<span>.</span></span>
            </div>
            <span className="form-step">TU ESPACIO DE TRABAJO</span>
            <h2>¡Hola de nuevo!</h2>
            <p className="form-intro">Ingresa tus datos para continuar.</p>
            <form className="login-form" onSubmit={handleLogin}>
              <label htmlFor="login-email">Correo electrónico</label>
              <div className="input-wrap">
                <Icon name="email" size={18} />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  placeholder="nombre@empresa.com"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  required
                />
              </div>
              <label htmlFor="login-password">Contraseña</label>
              <div className="input-wrap">
                <Icon name="lock" size={18} />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-primary login-submit" type="submit">
                Iniciar sesión <Icon name="arrow" size={17} />
              </button>
            </form>
            {process.env.NODE_ENV !== "production" && <div className="login-tip">
              <span className="tip-icon"><Icon name="lock" size={16} /></span>
              <span>Acceso local de demostración<br /><strong>admin@bcp.local</strong> · <strong>BcpLocal2026!</strong></span>
            </div>}
            <p className="login-help">¿Necesitas ayuda? <a href="mailto:soporte@bcp.local">Contacta al administrador</a></p>
          </div>
          <div className="form-panel-bottom">Un espacio seguro para hacer crecer a tu equipo.</div>
        </section>
      </main>
    );
  }

  const pageTitle =
    activePage === "dashboard" ? "Resumen general" : activePage === "team" ? "Team Members" : "Proyectos";
  const firstName = userEmail.split("@")[0].split(/[._-]/)[0];
  const greetingName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <main className="app-shell">
      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <button className="sidebar-brand" onClick={() => setActivePage("dashboard")}>
          <span className="brand-mark"><span>B</span></span>
          <span className="sidebar-brand-text">bitácora<span>+</span><small>SEGUIMIENTO DE EQUIPO</small></span>
        </button>
        <div className="sidebar-section-label">ESPACIO DE TRABAJO</div>
        <nav className="side-nav" aria-label="Navegación principal">
          <button className={activePage === "dashboard" ? "nav-item nav-active" : "nav-item"} onClick={() => { setActivePage("dashboard"); setSidebarOpen(false); }}>
            <Icon name="grid" /><span>Dashboard</span>
          </button>
          <button className={activePage === "team" ? "nav-item nav-active" : "nav-item"} onClick={() => { setActivePage("team"); setSidebarOpen(false); }}>
            <Icon name="team" /><span>Team Members</span><span className="nav-count">{workspace.members.length}</span>
          </button>
          <button className={activePage === "projects" ? "nav-item nav-active" : "nav-item"} onClick={() => { setActivePage("projects"); setSidebarOpen(false); }}>
            <Icon name="briefcase" /><span>Proyectos</span><span className="nav-count">{workspace.projects.length}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-burst"><Icon name="activity" size={17} /></div>
            <strong>Un equipo alineado<br />llega más lejos.</strong>
            <span>Un paso a la vez, un gran equipo.</span>
          </div>
          <button className="profile-row" onClick={() => void handleLogout()} title="Cerrar sesión">
            <span className="profile-avatar">{initialsFromName(greetingName)}</span>
            <span className="profile-details"><strong>{greetingName}</strong><small>Administradora</small></span>
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} />}
      <section className="main-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
          <div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={14} /><strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <span className="today-date"><Icon name="calendar" size={16} /> {new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}</span>
            <button className="icon-button notification-button" aria-label="Notificaciones"><Icon name="bell" size={18} /><i /></button>
            <button className="topbar-user" onClick={() => void handleLogout()} title="Cerrar sesión">
              <span className="profile-avatar">{initialsFromName(greetingName)}</span><Icon name="chevron" size={15} />
            </button>
          </div>
        </header>

        <div className="content-wrap">
          {error && <div className="notice notice-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Cerrar"><Icon name="close" size={15} /></button></div>}
          {notice && <div className="notice notice-success" role="status"><Icon name="check" size={16} />{notice}</div>}

          {activePage === "dashboard" && (
            <DashboardHome
              members={workspace.members}
              projects={workspace.projects}
              logEntries={workspace.logEntries}
              activeMembers={activeMembers}
              inProgressProjects={inProgressProjects}
              averageProgress={averageProgress}
              greetingName={greetingName}
              onNavigate={setActivePage}
              onSelectMember={setMemberModal}
            />
          )}

          {activePage === "team" && (
            <section className="page-section">
              <div className="page-heading">
                <div><span className="eyebrow">LAS PERSONAS DETRÁS DEL PROGRESO</span><h1>Team Members<span className="heading-period">.</span></h1><p>Conoce, acompaña y mantén al día la información de tu equipo.</p></div>
                <button className="button button-primary" onClick={() => setMemberModal("new")}><Icon name="plus" size={18} /> Agregar miembro</button>
              </div>
              <div className="team-toolbar">
                <div className="search-box"><Icon name="search" size={18} /><input aria-label="Buscar personas" placeholder="Buscar por nombre, rol o proyecto..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                <span className="result-count">{filteredMembers.length} personas en el equipo</span>
              </div>
              {filteredMembers.length ? (
                <div className="member-grid">
                  {filteredMembers.map((member, index) => (
                    <button className="member-card" key={member.id} onClick={() => setMemberModal(member)} style={{ animationDelay: `${index * 45}ms` }}>
                      <span className="member-card-top"><TeamAvatar member={member} large /><span className={`status-pill ${member.status === "Activo" ? "status-active" : member.status === "En vacaciones" ? "status-away" : "status-inactive"}`}><i />{member.status}</span></span>
                      <strong className="member-name">{member.name}</strong><span className="member-role">{member.role}</span>
                      <span className="member-divider" />
                      <span className="member-meta"><span><Icon name="briefcase" size={15} />{member.project || "Sin proyecto"}</span><span><Icon name="activity" size={15} />{member.progress}% avance</span></span>
                      <span className="member-progress"><i style={{ width: `${member.progress}%` }} /></span>
                      <span className="member-card-link">Ver perfil <Icon name="chevron" size={15} /></span>
                    </button>
                  ))}
                </div>
              ) : <EmptyState title="No encontramos a nadie" message="Prueba con otro término o agrega un nuevo miembro al equipo." action="Agregar miembro" onAction={() => setMemberModal("new")} />}
            </section>
          )}

          {activePage === "projects" && (
            <section className="page-section">
              <div className="page-heading">
                <div><span className="eyebrow">LO QUE ESTAMOS CONSTRUYENDO</span><h1>Proyectos<span className="heading-period">.</span></h1><p>Una vista clara de cada iniciativa y del camino que falta recorrer.</p></div>
                <button className="button button-primary" onClick={() => setProjectModal("new")}><Icon name="plus" size={18} /> Nuevo proyecto</button>
              </div>
              <div className="project-overview-strip">
                <span><b>{workspace.projects.length}</b> iniciativas en total</span><span><i className="legend-dot legend-blue" />En curso <b>{inProgressProjects}</b></span><span><i className="legend-dot legend-orange" />En planificación <b>{workspace.projects.filter((project) => project.status === "En planificación").length}</b></span><span><i className="legend-dot legend-green" />Completados <b>{workspace.projects.filter((project) => project.status === "Completado").length}</b></span>
              </div>
              <div className="project-list">
                {workspace.projects.map((project, index) => (
                  <article
                    className="project-card"
                    key={project.id}
                    style={{ animationDelay: `${index * 55}ms` }}
                  >
                    <Link className="project-card-content" href={`/projects/${encodeURIComponent(project.id)}`} aria-label={`Abrir requerimientos de ${project.name}`}>
                      <span className={`project-symbol project-${project.color}`}><Icon name="briefcase" size={21} /></span>
                      <span className="project-info"><span className="project-title-row"><strong>{project.name}</strong><span className={`status-pill ${project.status === "En curso" ? "status-active" : project.status === "Completado" ? "status-done" : "status-planning"}`}><i />{project.status}</span></span><span className="project-description">{project.description}</span><span className="project-detail-row"><span><Icon name="team" size={15} />{project.team} personas</span><span><Icon name="calendar" size={15} />Entrega: {formatDate(project.dueDate)}</span></span></span>
                      <span className="project-progress-wrap"><span className="project-progress-number">{project.progress}<small>%</small></span><span className="project-progress-track"><i style={{ width: `${project.progress}%` }} /></span><small>abrir detalle</small></span>
                    </Link>
                    <span className="project-actions">
                      <button
                        className="project-edit-button"
                        aria-label={`Editar ${project.name}`}
                        title="Editar configuración del proyecto"
                        onClick={() => setProjectModal(project)}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        className="project-edit-button project-delete-button"
                        aria-label={`Eliminar ${project.name}`}
                        title="Eliminar proyecto"
                        onClick={() => deleteProject(project)}
                        disabled={saving}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </span>
                  </article>
                ))}
                {!workspace.projects.length && <EmptyState title="Tu próximo gran proyecto empieza aquí" message="Crea una iniciativa para organizar el trabajo y seguir su progreso." action="Crear proyecto" onAction={() => setProjectModal("new")} />}
              </div>
            </section>
          )}
        </div>
      </section>

      {memberModal && <MemberEditor member={memberModal === "new" ? null : memberModal} projects={workspace.projects} requirements={workspace.requirements} logEntries={workspace.logEntries.filter((entry) => entry.memberId === (memberModal === "new" ? "" : memberModal.id))} saving={saving} onClose={() => setMemberModal(null)} onSave={saveMember} onAddLog={async (entry) => persistWorkspace({ ...workspace, logEntries: [entry, ...workspace.logEntries] }, false)} onDeleteLog={async (entryId) => persistWorkspace({ ...workspace, logEntries: workspace.logEntries.filter((entry) => entry.id !== entryId) }, false)} />}
      {projectModal && <ProjectEditor project={projectModal === "new" ? null : projectModal} requirements={workspace.requirements} saving={saving} onClose={() => setProjectModal(null)} onSave={saveProject} />}
    </main>
  );
}

function DashboardHome({
  members,
  projects,
  logEntries,
  activeMembers,
  inProgressProjects,
  averageProgress,
  greetingName,
  onNavigate,
  onSelectMember,
}: {
  members: TeamMember[];
  projects: Project[];
  logEntries: LogEntry[];
  activeMembers: number;
  inProgressProjects: number;
  averageProgress: number;
  greetingName: string;
  onNavigate: (page: "dashboard" | "team" | "projects") => void;
  onSelectMember: (member: TeamMember) => void;
}) {
  const openProjects = projects.filter((project) => project.status === "En curso").slice(0, 3);
  const projectProgressPath = progressPath(projects.map((project) => project.progress));
  const latestProjectProgress = projects.length ? projects[projects.length - 1].progress : 0;
  const latestProjectX = projects.length < 2 ? 310 : 620;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentFollowUps = logEntries.filter((entry) => new Date(`${entry.date}T12:00:00`) >= weekAgo).length;
  return (
    <section className="dashboard-page">
      <div className="welcome-row">
        <div><span className="eyebrow">{new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "2-digit", month: "long" }).format(new Date()).toUpperCase()}</span><h1>¡Hola, {greetingName}! <span className="wave">✳</span></h1><p>Aquí tienes el pulso de tu equipo. <strong>Todo avanza mejor cuando estamos conectados.</strong></p></div>
        <button className="button button-outline" onClick={() => onNavigate("team")}><Icon name="team" size={17} /> Ver equipo completo <Icon name="arrow" size={15} /></button>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Personas en el equipo" value={members.length} change={`${activeMembers} disponibles`} icon="team" tone="blue" />
        <MetricCard label="Proyectos en marcha" value={inProgressProjects} change={`${projects.length} iniciativas en total`} icon="briefcase" tone="orange" />
        <MetricCard label="Avance promedio" value={`${averageProgress}%`} change="del portafolio activo" icon="chart" tone="violet" />
        <MetricCard label="Seguimientos esta semana" value={recentFollowUps} change="en la bitácora del equipo" icon="activity" tone="green" />
      </div>
      <div className="dashboard-grid">
        <section className="panel progress-panel">
          <div className="panel-heading"><div><span className="eyebrow">AVANCE ACTUAL DE PROYECTOS</span><h2>Así van los proyectos</h2></div><span className="chart-period">Vista de hoy</span></div>
          <div className="chart-key"><span><i className="key-dot key-blue" />Proyectos</span></div>
          <div className="line-chart" role="img" aria-label="Gráfico del avance actual de los proyectos">
            <div className="chart-axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
            <svg viewBox="0 0 620 190" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="blueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1e4fc2" stopOpacity=".16" /><stop offset="1" stopColor="#1e4fc2" stopOpacity="0" /></linearGradient></defs>
              <path className="chart-grid-line" d="M0 12H620M0 53H620M0 94H620M0 135H620M0 176H620" />
            {projects.length > 1 && <path className="chart-area" d={`${projectProgressPath} L 620 176 L 0 176 Z`} />}
            <path className="chart-line chart-line-blue" d={projectProgressPath} />
            {projects.length > 0 && <circle className="chart-point" cx={latestProjectX} cy={12 + ((100 - latestProjectProgress) / 100) * 164} r="4.5" />}
          </svg>
          <div className="chart-months"><span>Proyectos</span><span>Avance actual</span></div>
          </div>
        </section>
        <section className="panel team-pulse-panel">
          <div className="panel-heading"><div><span className="eyebrow">PULSO DEL EQUIPO</span><h2>Personas activas</h2></div><button className="text-link" onClick={() => onNavigate("team")}>Ver todos <Icon name="arrow" size={14} /></button></div>
          <div className="team-pulse-content">
            <div className="donut-wrap"><div className="donut-chart" style={{ "--donut-value": `${members.length ? (activeMembers / members.length) * 100 : 0}%` } as React.CSSProperties}><div><strong>{activeMembers}</strong><span>de {members.length}</span></div></div></div>
            <div className="pulse-legend"><span><i className="legend-dot legend-blue" />Disponibles <b>{activeMembers}</b></span><span><i className="legend-dot legend-orange" />En vacaciones <b>{members.filter((member) => member.status === "En vacaciones").length}</b></span><span><i className="legend-dot legend-muted" />Inactivos <b>{members.filter((member) => member.status === "Inactivo").length}</b></span></div>
          </div>
          <div className="pulse-caption"><span className="caption-check"><Icon name="check" size={14} /></span>Buen ritmo, equipo. Sigamos así.</div>
        </section>
      </div>
      <div className="lower-dashboard-grid">
        <section className="panel projects-panel">
          <div className="panel-heading"><div><span className="eyebrow">INICIATIVAS EN CURSO</span><h2>Proyectos que avanzan</h2></div><button className="text-link" onClick={() => onNavigate("projects")}>Ver todos <Icon name="arrow" size={14} /></button></div>
          <div className="mini-project-list">
            {openProjects.map((project) => (
              <div className="mini-project" key={project.id}><span className={`project-symbol project-${project.color}`}><Icon name="briefcase" size={17} /></span><span className="mini-project-name"><strong>{project.name}</strong><small>{project.team} personas</small></span><span className="mini-progress"><i style={{ width: `${project.progress}%` }} /></span><strong className="mini-progress-value">{project.progress}%</strong></div>
            ))}
            {!openProjects.length && <p className="empty-inline">Todavía no hay proyectos en curso.</p>}
          </div>
        </section>
        <section className="panel people-panel">
          <div className="panel-heading"><div><span className="eyebrow">QUIENES HACEN QUE PASE</span><h2>Tu equipo</h2></div><button className="text-link" onClick={() => onNavigate("team")}>Ver todos <Icon name="arrow" size={14} /></button></div>
          <div className="people-list">
            {members.slice(0, 4).map((member) => <button className="person-row" key={member.id} onClick={() => onSelectMember(member)}><TeamAvatar member={member} /><span><strong>{member.name}</strong><small>{member.role}</small></span><span className="person-arrow"><Icon name="chevron" size={16} /></span></button>)}
            {!members.length && <p className="empty-inline">Agrega miembros para comenzar a hacer seguimiento.</p>}
          </div>
        </section>
      </div>
      <div className="dashboard-footnote"><span><i />Datos guardados localmente</span><span>Actualizado ahora <Icon name="clock" size={13} /></span></div>
    </section>
  );
}

function MetricCard({ label, value, change, icon, tone }: { label: string; value: string | number; change: string; icon: IconName; tone: string }) {
  return <article className="metric-card"><span className={`metric-icon metric-${tone}`}><Icon name={icon} size={19} /></span><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-change"><i />{change}</span><span className={`metric-corner metric-corner-${tone}`} /></article>;
}

function EmptyState({ title, message, action, onAction }: { title: string; message: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="grid" size={22} /></span><h2>{title}</h2><p>{message}</p><button className="button button-primary" onClick={onAction}><Icon name="plus" size={17} />{action}</button></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><span className="eyebrow">BITÁCORA DE SEGUIMIENTO</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button></div>{children}</section></div>;
}

function MemberEditor({ member, projects, requirements, logEntries, saving, onClose, onSave, onAddLog, onDeleteLog }: { member: TeamMember | null; projects: Project[]; requirements: Requirement[]; logEntries: LogEntry[]; saving: boolean; onClose: () => void; onSave: (member: TeamMember) => void; onAddLog: (entry: LogEntry) => Promise<boolean>; onDeleteLog: (entryId: string) => Promise<boolean> }) {
  const [form, setForm] = useState<TeamMember>(() => member ? {
    ...member,
    role: member.role || "Backend Engineer",
    area: member.area || "Ingeniería",
    project: projects.some((project) => project.name === member.project) ? member.project : "",
  } : {
    id: createId("tm"),
    name: "",
    role: "Backend Engineer",
    email: "",
    area: "Ingeniería",
    status: "Activo",
    initials: "",
    color: "blue",
    project: "",
    progress: 0,
    joinedAt: new Date().toISOString().slice(0, 10),
  });
  const memberProgress = calculateTeamMemberProgress(requirements, form.id);
  const roleOptions = ["Backend Engineer", "Quality Engineer"];
  const legacyRole = form.role && !roleOptions.includes(form.role) ? form.role : "";
  const [logCategory, setLogCategory] = useState("Avance");
  const [logNote, setLogNote] = useState("");
  const [savingLog, setSavingLog] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState("");
  async function addLog() {
    if (!member || !logNote.trim()) return;
    setSavingLog(true);
    const saved = await onAddLog({
      id: createId("log"),
      memberId: member.id,
      date: new Date().toISOString().slice(0, 10),
      category: logCategory,
      note: logNote.trim(),
    });
    if (saved) setLogNote("");
    setSavingLog(false);
  }
  async function deleteLog(entry: LogEntry) {
    if (!window.confirm(`¿Eliminar el seguimiento «${entry.category}» del ${formatDate(entry.date)}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeletingLogId(entry.id);
    await onDeleteLog(entry.id);
    setDeletingLogId("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ ...form, progress: memberProgress, initials: initialsFromName(form.name) });
  }
  return <Modal title={member ? "Perfil del miembro" : "Nuevo miembro"} onClose={onClose}><form className="editor-form" onSubmit={submit}>
    <div className="editor-profile-preview"><TeamAvatar member={form} large /><span><strong>{form.name || "Nombre del miembro"}</strong><small>{form.role || "Rol en el equipo"}</small></span></div>
    <div className="form-grid"><label>Nombre completo<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120} placeholder="Ej. Mariana Pérez" /></label><label>Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} required>{legacyRole && <option value={legacyRole}>{legacyRole} · actual</option>}{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><label>Correo electrónico<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength={254} placeholder="nombre@empresa.com" /></label><label>Área<input value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} required maxLength={120} placeholder="Ingeniería" /></label><label>Proyecto asignado<select value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })}><option value="">Sin proyecto</option>{projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select></label><label>Estado<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TeamMember["status"] })}><option>Activo</option><option>En vacaciones</option><option>Inactivo</option></select></label><div className="full-field"><span className="validation-form-label">Avance según requerimientos asignados</span><div className="project-editor-progress"><strong>{memberProgress}%</strong><span className="project-progress-track"><i style={{ width: `${memberProgress}%` }} /></span></div></div></div>
    {member && <section className="logbook-section"><div className="logbook-heading"><div><span className="eyebrow">SEGUIMIENTO INDIVIDUAL</span><h3>Bitácora de {member.name.split(" ")[0]}</h3></div><span className="logbook-count">{logEntries.length} registros</span></div><div className="logbook-entry-form"><select aria-label="Tipo de seguimiento" value={logCategory} onChange={(event) => setLogCategory(event.target.value)}><option>Avance</option><option>Bloqueo</option><option>Acuerdo</option><option>Reconocimiento</option></select><textarea aria-label="Nota de seguimiento" value={logNote} onChange={(event) => setLogNote(event.target.value)} maxLength={1000} rows={2} placeholder="¿Qué conversaron o qué avance quieres registrar?" /><button className="button button-primary" type="button" onClick={() => void addLog()} disabled={savingLog || saving || !logNote.trim()}><Icon name="plus" size={15} />{savingLog ? "Guardando..." : "Registrar"}</button></div><div className="logbook-list">{logEntries.map((entry) => <article className="logbook-entry" key={entry.id}><i className={`logbook-marker logbook-marker-${entry.category.toLowerCase()}`} /><div><span><strong>{entry.category}</strong><time>{formatDate(entry.date)}</time></span><p>{entry.note}</p></div><button className="logbook-delete-button" type="button" aria-label={`Eliminar seguimiento ${entry.category} del ${formatDate(entry.date)}`} title="Eliminar seguimiento" onClick={() => void deleteLog(entry)} disabled={saving || savingLog || Boolean(deletingLogId)}><Icon name="trash" size={15} /></button></article>)}{!logEntries.length && <p className="logbook-empty">Todavía no hay seguimientos. Registra aquí el primer avance, acuerdo o bloqueo.</p>}</div></section>}
    <div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : member ? "Guardar cambios" : "Agregar miembro"}</button></div>
  </form></Modal>;
}

function ProjectEditor({ project, requirements, saving, onClose, onSave }: { project: Project | null; requirements: Requirement[]; saving: boolean; onClose: () => void; onSave: (project: Project) => void }) {
  const [form, setForm] = useState<Project>(project || {
    id: createId("pr"),
    name: "",
    description: "",
    status: "En planificación",
    progress: 0,
    team: 0,
    dueDate: new Date().toISOString().slice(0, 10),
    color: "blue",
  });
  const calculatedProgress = calculateProjectProgress(
    requirements.filter((requirement) => requirement.projectId === form.id),
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ ...form, progress: calculatedProgress });
  }
  return <Modal title={project ? "Detalles del proyecto" : "Nuevo proyecto"} onClose={onClose}><form className="editor-form" onSubmit={submit}>
    <div className="editor-profile-preview"><span className={`project-symbol project-${form.color}`}><Icon name="briefcase" size={21} /></span><span><strong>{form.name || "Nombre del proyecto"}</strong><small>{form.status}</small></span></div>
    <div className="form-grid"><label className="full-field">Nombre del proyecto<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120} placeholder="Ej. Nueva experiencia móvil" /></label><label className="full-field">Descripción<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={500} rows={3} placeholder="¿Qué queremos lograr?" /></label><label>Estado<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Project["status"] })}><option>En planificación</option><option>En curso</option><option>Completado</option></select></label><label>Fecha de entrega<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} required /></label><label>Personas en el equipo<input type="number" min="0" max="500" value={form.team} onChange={(event) => setForm({ ...form, team: Number(event.target.value) })} /></label><div className="full-field"><span className="validation-form-label">Avance general calculado</span><div className="project-editor-progress"><strong>{calculatedProgress}%</strong><span className="project-progress-track"><i style={{ width: `${calculatedProgress}%` }} /></span></div></div></div>
    <div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : project ? "Guardar cambios" : "Crear proyecto"}</button></div>
  </form></Modal>;
}
