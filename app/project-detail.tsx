"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import RequirementAlerts, {
  getDaysUntilDeadline,
  useCurrentDate,
} from "@/app/requirement-alerts";
import {
  calculateProjectProgress,
  calculateTeamMemberProgress,
  createId,
  getRequirementStatuses,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPES,
} from "@/lib/workspace";
import type {
  Project,
  Requirement,
  RequirementLog,
  RequirementStatus,
  TeamMember,
  WorkspaceData,
} from "@/lib/workspace";

const emptyWorkspace: WorkspaceData = {
  members: [],
  projects: [],
  logEntries: [],
  requirements: [],
  requirementLogs: [],
};

const requirementStatuses: RequirementStatus[] = [...REQUIREMENT_STATUSES];

const validationLabels = [
  ["functional", "Funcionales"],
  ["performance", "Performance"],
  ["owasp", "OWASP"],
  ["ethicalHacking", "Ethical hacking"],
] as const;

function Icon({ name, size = 17 }: { name: "arrow" | "back" | "calendar" | "check" | "chevron" | "clock" | "edit" | "plus" | "search" | "team" | "trash"; size?: number }) {
  const shared = {
    "aria-hidden": true as const,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths = {
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    back: <><path d="m15 18-6-6 6-6" /><path d="M20 12H9" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    team: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
  };
  return <svg {...shared}>{paths[name]}</svg>;
}

function formatDate(value: string) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

function StatusPill({ status }: { status: RequirementStatus }) {
  const tone = status === "Done"
    ? "done"
    : status === "Bloqueado"
      ? "blocked"
      : status === "Gestión de pase"
        ? "review"
        : status === "Abierto"
          ? "pending"
        : status === "Desarrollo"
          ? "active"
          : status === "Reversión"
            ? "revert"
            : status === "Congelamiento" || status === "Recongelamiento"
              ? "freeze"
              : "pending";
  return <span className={`status-pill requirement-status-${tone}`}><i />{status}</span>;
}

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  function goBackToProjects() {
    if (
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin)
    ) {
      router.back();
    } else {
      router.push("/");
    }
  }
  const [workspace, setWorkspace] = useState<WorkspaceData>(emptyWorkspace);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequirementStatus | "Todos">("Todos");
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | "new" | null>(null);
  const todayDate = useCurrentDate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const session = await sessionResponse.json();
        if (!sessionResponse.ok) throw new Error(session.error || "No se pudo comprobar la sesión.");
        if (!session.email) {
          router.replace("/");
          return;
        }
        const response = await fetch("/api/workspace");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar el proyecto.");
        if (!cancelled) {
          setUserEmail(session.email);
          setWorkspace(data as WorkspaceData);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el proyecto.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const project = workspace.projects.find((item) => item.id === projectId);
  const projectRequirements = workspace.requirements.filter((item) => item.projectId === projectId);
  const filteredRequirements = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return projectRequirements.filter((requirement) => {
      const member = workspace.members.find((item) => item.id === requirement.assigneeId);
      const matchesTerm =
        !term ||
        `${requirement.title} ${requirement.description} ${member?.name || ""} ${requirement.qeAssignee} ${requirement.ocdType}`
          .toLocaleLowerCase()
          .includes(term);
      return matchesTerm && (statusFilter === "Todos" || requirement.status === statusFilter);
    });
  }, [projectRequirements, search, statusFilter, workspace.members]);

  async function persist(nextWorkspace: WorkspaceData) {
    setSaving(true);
    setError("");
    try {
      const workspaceWithCalculatedProgress = {
        ...nextWorkspace,
        members: nextWorkspace.members.map((member) => ({
          ...member,
          progress: calculateTeamMemberProgress(nextWorkspace.requirements, member.id),
        })),
        projects: nextWorkspace.projects.map((item) => ({
          ...item,
          progress: calculateProjectProgress(
            nextWorkspace.requirements.filter((requirement) => requirement.projectId === item.id),
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
      setSelectedRequirement(null);
      setEditingRequirement(null);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los cambios.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function saveRequirement(requirement: Requirement) {
    const requirements = workspace.requirements.some((item) => item.id === requirement.id)
      ? workspace.requirements.map((item) => item.id === requirement.id ? requirement : item)
      : [requirement, ...workspace.requirements];
    void persist({ ...workspace, requirements });
  }

  async function deleteRequirement(requirement: Requirement) {
    const linkedLogCount = workspace.requirementLogs.filter(
      (entry) => entry.requirementId === requirement.id,
    ).length;
    const linkedLogsMessage = linkedLogCount
      ? ` También se eliminarán ${linkedLogCount} avance(s) asociado(s) de la bitácora.`
      : "";
    if (!window.confirm(`¿Eliminar el requerimiento «${requirement.title}»?${linkedLogsMessage} Esta acción no se puede deshacer.`)) {
      return;
    }

    await persist({
      ...workspace,
      requirements: workspace.requirements.filter((item) => item.id !== requirement.id),
      requirementLogs: workspace.requirementLogs.filter(
        (entry) => entry.requirementId !== requirement.id,
      ),
    });
  }

  async function addDailyEntry(requirement: Requirement, status: RequirementStatus, note: string) {
    const member = workspace.members.find((item) => item.id === requirement.assigneeId);
    if (!member) {
      setError("Asigna una persona responsable al requerimiento antes de registrar avances.");
      return false;
    }
    const entry: RequirementLog = {
      id: createId("reqlog"),
      requirementId: requirement.id,
      memberId: member.id,
      memberName: member.name,
      date: today(),
      status,
      note: note.trim(),
    };
    const updatedRequirement = { ...requirement, status };
    const nextWorkspace = {
      ...workspace,
      requirements: workspace.requirements.map((item) =>
        item.id === requirement.id ? updatedRequirement : item,
      ),
      requirementLogs: [entry, ...workspace.requirementLogs],
    };
    const saved = await persist(nextWorkspace);
    if (saved) setSelectedRequirement(updatedRequirement);
    return saved;
  }

  async function editDailyEntry(requirement: Requirement, updatedEntry: RequirementLog) {
    const previousEntry = workspace.requirementLogs.find((entry) => entry.id === updatedEntry.id);
    if (!previousEntry || previousEntry.requirementId !== requirement.id) {
      setError("No encontramos el avance que intentas editar.");
      return false;
    }

    const requirementLogs = workspace.requirementLogs.map((entry) =>
      entry.id === updatedEntry.id ? updatedEntry : entry,
    );
    const previousRequirementLogs = workspace.requirementLogs.filter(
      (entry) => entry.requirementId === requirement.id,
    );
    const previousLatestEntry = [...previousRequirementLogs].sort((a, b) =>
      b.date.localeCompare(a.date),
    )[0];
    const updatedRequirementLogs = requirementLogs
      .filter((entry) => entry.requirementId === requirement.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const latestEntry = updatedRequirementLogs[0];
    const editedEntryIsLatest =
      previousLatestEntry?.id === updatedEntry.id ||
      updatedEntry.date > (previousLatestEntry?.date || "");
    const updatedRequirement = editedEntryIsLatest && latestEntry
      ? { ...requirement, status: latestEntry.status }
      : requirement;

    const saved = await persist({
      ...workspace,
      requirements: workspace.requirements.map((item) =>
        item.id === requirement.id ? updatedRequirement : item,
      ),
      requirementLogs,
    });
    if (saved) setSelectedRequirement(updatedRequirement);
    return saved;
  }

  if (loading) {
    return <main className="startup-screen"><span className="loading-dots">Cargando proyecto</span></main>;
  }

  if (!userEmail) {
    return <main className="project-detail-shell"><div className="content-wrap"><div className="notice notice-error" role="alert">{error || "No se pudo cargar la sesión."}</div><button className="button button-outline" onClick={() => router.push("/")}><Icon name="back" /> Volver al inicio de sesión</button></div></main>;
  }

  if (!project) {
    return <main className="project-detail-shell"><div className="content-wrap"><button className="back-link" onClick={goBackToProjects}><Icon name="back" /> Volver a proyectos</button><div className="empty-state"><h2>No encontramos este proyecto</h2><p>Es posible que se haya eliminado o que el enlace no sea correcto.</p><button className="button button-primary" onClick={goBackToProjects}>Ver proyectos</button></div></div></main>;
  }

  const doneCount = projectRequirements.filter((item) => item.status === "Done").length;
  const activeCount = projectRequirements.filter(
    (item) => item.status !== "Abierto" && item.status !== "Done" && item.status !== "Bloqueado",
  ).length;
  const blockedCount = projectRequirements.filter((item) => item.status === "Bloqueado").length;
  const projectLogs = workspace.requirementLogs
    .filter((entry) => projectRequirements.some((requirement) => requirement.id === entry.requirementId))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="project-detail-shell">
      <header className="topbar">
        <button className="back-link" onClick={goBackToProjects}><Icon name="back" /> Proyectos</button>
        <div className="topbar-actions"><span className="today-date"><Icon name="calendar" size={16} />{new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}</span><span className="profile-avatar">{initials(userEmail.split("@")[0])}</span></div>
      </header>
      <div className="content-wrap project-detail-content">
        {error && <div className="notice notice-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Cerrar">×</button></div>}
        <div className="project-detail-heading">
          <div className="project-detail-title">
            <button className={`project-symbol project-${project.color}`} aria-hidden="true"><span className="project-monogram">{initials(project.name)}</span></button>
            <div><span className="eyebrow">DETALLE DEL PROYECTO</span><h1>{project.name}<span className="heading-period">.</span></h1><p>{project.description || "Alcance, requerimientos y seguimiento diario del proyecto."}</p></div>
          </div>
          <span className={`status-pill ${project.status === "Completado" ? "status-done" : project.status === "En curso" ? "status-active" : "status-planning"}`}><i />{project.status}</span>
        </div>

        <section className="project-detail-stats" aria-label="Resumen de requerimientos">
          <div><span>Requerimientos</span><strong>{projectRequirements.length}</strong></div>
          <div><span>En curso</span><strong>{activeCount}</strong></div>
          <div><span>Completados</span><strong>{doneCount}</strong></div>
          <div><span>Bloqueados</span><strong>{blockedCount}</strong></div>
          <div className="project-progress-stat"><span>Avance general del proyecto</span><strong>{project.progress}%</strong><span className="project-progress-track"><i style={{ width: `${project.progress}%` }} /></span></div>
        </section>

        <section className="requirements-panel">
          <div className="requirements-heading">
            <div><span className="eyebrow">ALCANCE Y COMPROMISOS</span><h2>Requerimientos</h2><p>Cada fila es un requerimiento. Ábrelo para consultar o registrar su avance diario.</p></div>
            <button className="button button-primary" onClick={() => setEditingRequirement("new")}><Icon name="plus" /> Nuevo requerimiento</button>
          </div>
          <div className="requirements-toolbar">
            <label className="search-box"><Icon name="search" /><input aria-label="Buscar requerimientos" placeholder="Buscar requerimiento, responsable o QA..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <select className="requirements-status-filter" aria-label="Filtrar requerimientos por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RequirementStatus | "Todos")}><option>Todos</option>{requirementStatuses.map((status) => <option key={status}>{status}</option>)}</select>
            <span className="requirements-count">{filteredRequirements.length} de {projectRequirements.length}</span>
          </div>
          <div className="requirements-table-scroll">
            <table className="requirements-table">
              <thead><tr>
                <th>Requerimiento</th><th>Responsable · QE</th><th>Tipo OCD</th><th>Estado</th><th>Validaciones</th><th>Inicio</th><th>Deadline</th><th>Hora de pase</th><th>Último avance</th><th aria-label="Acciones" />
              </tr></thead>
              <tbody>
                {filteredRequirements.map((requirement) => {
                  const assignee = workspace.members.find((member) => member.id === requirement.assigneeId);
                  const requirementLogs = workspace.requirementLogs.filter((entry) => entry.requirementId === requirement.id);
                  const logCount = requirementLogs.length;
                  const latestUpdateDate = requirementLogs.reduce(
                    (latest, entry) => entry.date > latest ? entry.date : latest,
                    requirement.registeredAt,
                  );
                  const daysUntilDeadline = getDaysUntilDeadline(requirement.deadline, todayDate);
                  const startsToday = requirement.startDate === todayDate && Boolean(todayDate);
                  const deadlineIsNear = !startsToday && daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 2;
                  const rowAlert = startsToday ? " requirement-row-starting-today" : deadlineIsNear ? " requirement-row-deadline-soon" : "";
                  return <tr key={requirement.id} className={`requirement-row${rowAlert}`} tabIndex={0} onClick={() => setSelectedRequirement(requirement)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRequirement(requirement); } }}>
                    <td><span className="requirement-cell-title">{requirement.title}{startsToday && <span className="requirement-date-alert requirement-date-alert-start">Inicia hoy</span>}{deadlineIsNear && <span className="requirement-date-alert requirement-date-alert-deadline">{daysUntilDeadline === 0 ? "Vence hoy" : daysUntilDeadline === 1 ? "Vence mañana" : "Vence en 2 días"}</span>}</span><span className="requirement-cell-description">{requirement.description || "Sin descripción"}</span><span className="requirement-log-count"><Icon name="clock" size={13} />{logCount} actualizaciones</span></td>
                    <td><span className="requirement-people"><b className="avatar avatar-blue">{assignee ? initials(assignee.name) : "?"}</b><span><strong>{assignee?.name || "Sin responsable"}</strong><small>Dev · {assignee?.role || "Asignar miembro"}</small><small>QE · {requirement.qeAssignee || "Sin asignar"}</small></span></span></td>
                    <td><span className="requirement-type">{requirement.ocdType || "—"}</span></td>
                    <td><StatusPill status={requirement.status} /></td>
                    <td><span className="validation-chips">{validationLabels.map(([key, label]) => <span className={requirement.validations[key] ? "validation-chip validation-chip-done" : "validation-chip"} key={key} title={`${label}: ${requirement.validations[key] ? "Sí" : "No"}`}>{label}<i>{requirement.validations[key] ? "✓" : "–"}</i></span>)}</span></td>
                    <td><span className="requirement-date">{requirement.startDate ? formatDate(requirement.startDate) : "—"}</span></td>
                    <td><span className="requirement-date"><Icon name="calendar" size={13} />{formatDate(requirement.deadline)}</span></td>
                    <td>{requirement.passTime || "—"}</td>
                    <td>{formatDate(latestUpdateDate)}</td>
                    <td className="requirement-actions-cell"><button className="requirement-delete-button" type="button" aria-label={`Eliminar requerimiento ${requirement.title}`} title="Eliminar requerimiento" disabled={saving} onClick={(event) => { event.stopPropagation(); void deleteRequirement(requirement); }} onKeyDown={(event) => event.stopPropagation()}><Icon name="trash" size={15} /></button></td>
                  </tr>;
                })}
              </tbody>
            </table>
            {!filteredRequirements.length && <div className="requirements-empty"><span className="empty-icon"><Icon name="search" size={20} /></span><strong>{projectRequirements.length ? "No encontramos requerimientos" : "Todavía no hay requerimientos"}</strong><p>{projectRequirements.length ? "Prueba con otro filtro o término de búsqueda." : "Agrega el primer requerimiento para documentar el alcance de este proyecto."}</p>{!projectRequirements.length && <button className="button button-primary" onClick={() => setEditingRequirement("new")}><Icon name="plus" /> Agregar requerimiento</button>}</div>}
          </div>
        </section>

        <section className="project-log-summary">
          <div><span className="eyebrow">ACTIVIDAD RECIENTE</span><h2>Bitácora del proyecto</h2></div>
          <div className="project-log-list">{projectLogs.slice(0, 3).map((entry) => {
            const requirement = projectRequirements.find((item) => item.id === entry.requirementId);
            return <article className="project-log-item" key={entry.id}><span className="logbook-marker" /><div><span><strong>{entry.memberName}</strong><time>{formatDate(entry.date)}</time></span><p><b>{requirement?.title || "Requerimiento"}</b> · {entry.note}</p></div><StatusPill status={entry.status} /></article>;
          })}{!projectLogs.length && <p className="logbook-empty">Los avances diarios registrados en cada requerimiento aparecerán aquí.</p>}</div>
        </section>
      </div>

      <RequirementAlerts
        requirements={workspace.requirements}
        members={workspace.members}
        projects={workspace.projects}
      />

      {selectedRequirement && <RequirementLogModal
        requirement={selectedRequirement}
        member={workspace.members.find((item) => item.id === selectedRequirement.assigneeId)}
        logs={workspace.requirementLogs.filter((entry) => entry.requirementId === selectedRequirement.id).sort((a, b) => b.date.localeCompare(a.date))}
        saving={saving}
        onClose={() => setSelectedRequirement(null)}
        onEdit={() => { setEditingRequirement(selectedRequirement); setSelectedRequirement(null); }}
        onAddEntry={addDailyEntry}
        onEditEntry={editDailyEntry}
      />}
      {editingRequirement && <RequirementEditor
        project={project}
        projects={workspace.projects}
        requirement={editingRequirement === "new" ? null : editingRequirement}
        members={workspace.members}
        saving={saving}
        onClose={() => setEditingRequirement(null)}
        onSave={saveRequirement}
      />}
    </main>
  );
}

function RequirementLogModal({
  requirement,
  member,
  logs,
  saving,
  onClose,
  onEdit,
  onAddEntry,
  onEditEntry,
}: {
  requirement: Requirement;
  member: TeamMember | undefined;
  logs: RequirementLog[];
  saving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddEntry: (requirement: Requirement, status: RequirementStatus, note: string) => Promise<boolean>;
  onEditEntry: (requirement: Requirement, entry: RequirementLog) => Promise<boolean>;
}) {
  const [status, setStatus] = useState(requirement.status);
  const [note, setNote] = useState("");
  const [editingLogId, setEditingLogId] = useState("");
  const [editStatus, setEditStatus] = useState<RequirementStatus>(requirement.status);
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const availableStatuses = getRequirementStatuses(requirement.ocdType);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) return;
    void onAddEntry(requirement, status, note).then((saved) => {
      if (saved) setNote("");
    });
  }
  function startEditingEntry(entry: RequirementLog) {
    setEditingLogId(entry.id);
    setEditStatus(entry.status);
    setEditDate(entry.date);
    setEditNote(entry.note);
  }
  async function saveEditedEntry(event: FormEvent<HTMLFormElement>, entry: RequirementLog) {
    event.preventDefault();
    if (!editNote.trim()) return;
    const saved = await onEditEntry(requirement, {
      ...entry,
      date: editDate,
      status: editStatus,
      note: editNote.trim(),
    });
    if (saved) setEditingLogId("");
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card requirement-log-modal" role="dialog" aria-modal="true" aria-label={`Bitácora de ${requirement.title}`}>
    <div className="modal-heading"><div><span className="eyebrow">BITÁCORA DIARIA · {requirement.title}</span><h2>Seguimiento del requerimiento</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></div>
    <div className="requirement-detail-meta"><span><small>Responsable</small><strong>{member?.name || "Sin responsable"}</strong></span><span><small>Estado actual</small><StatusPill status={requirement.status} /></span><span><small>Tipo OCD</small><strong>{requirement.ocdType || "—"}</strong></span><span><small>Deadline</small><strong>{formatDate(requirement.deadline)}</strong></span></div>
    <p className="requirement-detail-description">{requirement.description || "Sin descripción adicional."}</p>
    <div className="requirement-detail-actions"><span><strong>QE asignado:</strong> {requirement.qeAssignee || "Sin asignar"}</span><button className="button button-outline" onClick={onEdit}><Icon name="edit" size={15} /> Editar requerimiento</button></div>
    <form className="daily-update-form" onSubmit={submit}><div className="logbook-heading"><div><span className="eyebrow">REGISTRO DE HOY · {formatDate(today())}</span><h3>¿Qué avanzó hoy?</h3></div></div><div className="daily-update-fields"><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as RequirementStatus)}>{availableStatuses.map((item) => <option key={item}>{item}</option>)}</select></label><label className="daily-note-field">Avance o impedimento<textarea value={note} onChange={(event) => setNote(event.target.value)} required maxLength={2000} rows={3} placeholder="Describe lo que avanzaste, los acuerdos o los bloqueos de hoy." /></label></div><div className="daily-update-footer"><span>Este registro quedará asociado a {member?.name || "la persona responsable"}.</span><button className="button button-primary" type="submit" disabled={saving || !member || !note.trim()}><Icon name="plus" size={15} />{saving ? "Guardando..." : "Guardar avance del día"}</button></div></form>
    <section className="requirement-history"><div className="logbook-heading"><div><span className="eyebrow">HISTORIAL CRONOLÓGICO</span><h3>Actualizaciones anteriores</h3></div><span className="logbook-count">{logs.length} registros</span></div><div className="logbook-list">{logs.map((entry) => <article className="logbook-entry requirement-log-entry" key={entry.id}><i className="logbook-marker" /><div className="requirement-log-entry-content">{editingLogId === entry.id ? <form className="requirement-log-edit-form" onSubmit={(event) => void saveEditedEntry(event, entry)}><div className="requirement-log-edit-fields"><label>Fecha<input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} required /></label><label>Estado<select value={editStatus} onChange={(event) => setEditStatus(event.target.value as RequirementStatus)}>{availableStatuses.map((item) => <option key={item}>{item}</option>)}</select></label></div><label className="requirement-log-edit-note">Avance o impedimento<textarea value={editNote} onChange={(event) => setEditNote(event.target.value)} required maxLength={2000} rows={3} /></label><div className="requirement-log-edit-actions"><button className="button button-outline" type="button" onClick={() => setEditingLogId("")} disabled={saving}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving || !editNote.trim()}>{saving ? "Guardando..." : "Guardar cambios"}</button></div></form> : <><span><strong>{entry.memberName} · {entry.status}</strong><time>{formatDate(entry.date)}</time></span><p>{entry.note}</p></>}</div>{editingLogId !== entry.id && <button className="logbook-edit-button" type="button" aria-label={`Editar avance de ${entry.memberName} del ${formatDate(entry.date)}`} title="Editar avance" onClick={() => startEditingEntry(entry)} disabled={saving || Boolean(editingLogId)}><Icon name="edit" size={14} /></button>}</article>)}{!logs.length && <p className="logbook-empty">Este requerimiento aún no tiene avances. Registra el primero arriba.</p>}</div></section>
  </section></div>;
}

function RequirementEditor({
  project,
  projects,
  requirement,
  members,
  saving,
  onClose,
  onSave,
}: {
  project: Project;
  projects: Project[];
  requirement: Requirement | null;
  members: TeamMember[];
  saving: boolean;
  onClose: () => void;
  onSave: (requirement: Requirement) => void;
}) {
  const [form, setForm] = useState<Requirement>(requirement || {
    id: createId("req"),
    projectId: project.id,
    title: "",
    description: "",
    assigneeId: members[0]?.id || "",
    qeAssignee: "",
    ocdType: "OCD Normal",
    status: "Abierto",
    validations: { functional: false, performance: false, owasp: false, ethicalHacking: false },
    deadline: "",
    startDate: "",
    passTime: "",
    registeredAt: today(),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }
  const availableStatuses = getRequirementStatuses(form.ocdType);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card requirement-editor-modal" role="dialog" aria-modal="true" aria-label={requirement ? "Editar requerimiento" : "Nuevo requerimiento"}>
    <div className="modal-heading"><div><span className="eyebrow">PLANTILLA DE REQUERIMIENTOS · {project.name}</span><h2>{requirement ? "Editar requerimiento" : "Nuevo requerimiento"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></div>
    <form className="editor-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="full-field">Proyecto<select required value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="full-field">Requerimiento / API<input autoFocus required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ej. API-PYM-001 · Consulta de clientes" /></label>
        <label className="full-field">Alcance y descripción<textarea rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Qué debe hacer el requerimiento y cuáles son sus criterios de aceptación." /></label>
        <label>TM responsable<select required value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}><option value="" disabled>Selecciona un integrante</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label>
        <label>QE asignado<input maxLength={120} value={form.qeAssignee} onChange={(event) => setForm({ ...form, qeAssignee: event.target.value })} placeholder="Nombre del QA" /></label>
        <label>Tipo de OCD<select required value={form.ocdType} onChange={(event) => { const ocdType = event.target.value; const statuses = getRequirementStatuses(ocdType); setForm({ ...form, ocdType, status: statuses.includes(form.status) ? form.status : "Desarrollo" }); }}><option value="" disabled>Selecciona tipo de OCD</option>{REQUIREMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Estado actual<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RequirementStatus })}>{availableStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label>Fecha de inicio (opcional)<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
        <label>Deadline (opcional)<input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
        <label>Hora de pase<input type="time" value={form.passTime} onChange={(event) => setForm({ ...form, passTime: event.target.value })} /></label>
        <div className="full-field"><span className="validation-form-label">Validaciones <small>Marca las que requiere este requerimiento.</small></span><div className="validation-checkboxes">{validationLabels.map(([key, label]) => <label className="validation-checkbox" key={key}><input type="checkbox" checked={form.validations[key]} onChange={(event) => setForm({ ...form, validations: { ...form.validations, [key]: event.target.checked } })} /><span><Icon name="check" size={13} /></span>{label}</label>)}</div></div>
      </div>
      <p className="form-field-note">La fecha de alta se registra automáticamente. Observaciones y avances diarios se conservan en la bitácora del requerimiento.</p>
      <div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving || members.length === 0}>{saving ? "Guardando..." : requirement ? "Guardar cambios" : "Crear requerimiento"}</button></div>
      {!members.length && <p className="form-error" role="alert">Agrega primero un Team Member para asignarle este requerimiento.</p>}
    </form>
  </section></div>;
}
