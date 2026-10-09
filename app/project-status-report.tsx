"use client";

import { useState } from "react";

import { useCurrentDate } from "@/app/requirement-alerts";
import type { Project, Requirement, RequirementLog, TeamMember } from "@/lib/workspace";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

function createReportHtml({
  reportDate,
  requirements,
  requirementLogs,
  projects,
  members,
}: {
  reportDate: string;
  requirements: Requirement[];
  requirementLogs: RequirementLog[];
  projects: Project[];
  members: TeamMember[];
}) {
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const dailyLogs = new Map<string, RequirementLog[]>();
  for (const entry of requirementLogs) {
    if (entry.date !== reportDate) continue;
    const entries = dailyLogs.get(entry.requirementId) || [];
    entries.push(entry);
    dailyLogs.set(entry.requirementId, entries);
  }

  const statusCounts = requirements.reduce<Record<string, number>>((counts, requirement) => {
    counts[requirement.status] = (counts[requirement.status] || 0) + 1;
    return counts;
  }, {});
  const updateCount = [...dailyLogs.values()].reduce((total, entries) => total + entries.length, 0);
  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name, "es"));

  const memberSections = sortedMembers.map((member) => {
    const memberRequirements = requirements
      .filter((requirement) => requirement.assigneeId === member.id)
      .sort((a, b) =>
        (projectNames.get(a.projectId) || "").localeCompare(projectNames.get(b.projectId) || "", "es") ||
        a.title.localeCompare(b.title, "es"),
      );
    const memberUpdates = memberRequirements.reduce(
      (total, requirement) => total + (dailyLogs.get(requirement.id)?.length || 0),
      0,
    );
    const memberSummary = memberRequirements.length
      ? `${memberRequirements.length} ${memberRequirements.length === 1 ? "requerimiento asignado" : "requerimientos asignados"} · ${memberUpdates} ${memberUpdates === 1 ? "avance registrado" : "avances registrados"} el ${formatDate(reportDate)}`
      : "Sin requerimientos asignados actualmente";

    const requirementItems = memberRequirements.length
      ? memberRequirements.map((requirement) => {
          const projectName = projectNames.get(requirement.projectId) || "Proyecto sin nombre";
          const updates = dailyLogs.get(requirement.id) || [];
          const dateDetails = [
            requirement.startDate ? `Inicio: ${formatDate(requirement.startDate)}` : "",
            requirement.deadline ? `Deadline: ${formatDate(requirement.deadline)}` : "",
          ].filter(Boolean);
          const updatesHtml = updates.length
            ? `<ul class="updates">${updates.map((entry) => `
                <li><strong>Avance del día · ${escapeHtml(entry.status)}:</strong> ${escapeHtml(entry.note)}</li>
              `).join("")}</ul>`
            : `<p class="no-update">No se registró un avance en la bitácora para esta fecha.</p>`;

          return `
            <article class="requirement">
              <div class="requirement-heading">
                <div>
                  <span class="project-name">${escapeHtml(projectName)}</span>
                  <h3>${escapeHtml(requirement.title)}</h3>
                </div>
                <span class="status">${escapeHtml(requirement.status)}</span>
              </div>
              ${requirement.description ? `<p class="description">${escapeHtml(requirement.description)}</p>` : ""}
              <p class="context">Estado actual del requerimiento: <strong>${escapeHtml(requirement.status)}</strong>. Responsable: ${escapeHtml(member.name)}.${dateDetails.length ? ` ${escapeHtml(dateDetails.join(" · "))}.` : ""}</p>
              ${updatesHtml}
            </article>
          `;
        }).join("")
      : `<p class="no-assignments">Este integrante no tiene requerimientos asignados actualmente.</p>`;

    return `
      <section class="member">
        <div class="member-heading">
          <div><h2>${escapeHtml(member.name)}</h2><p>${escapeHtml(member.role)} · ${escapeHtml(member.area)}</p></div>
          <span class="member-summary">${escapeHtml(memberSummary)}</span>
        </div>
        ${requirementItems}
      </section>
    `;
  }).join("");

  const statusSummary = Object.entries(statusCounts)
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([status, count]) =>
      `<span class="summary-chip"><strong>${count}</strong> ${escapeHtml(status)}</span>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Status de actividades - Equipo de Desarrollo - ${escapeHtml(reportDate)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 34px; color: #24344e; background: #eef2f7; font: 14px/1.55 "Segoe UI", Arial, sans-serif; }
      .report { max-width: 920px; margin: 0 auto; padding: 42px 48px; background: #fff; box-shadow: 0 12px 38px #182b4718; }
      .eyebrow { color: #5571a0; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 9px 0 5px; color: #152844; font-size: 28px; letter-spacing: -.035em; }
      .report-date { margin: 0; color: #79869a; font-size: 12px; }
      .summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 7px; }
      .summary-chip { padding: 7px 10px; color: #5c6e89; border: 1px solid #e7edf5; border-radius: 7px; background: #f8faff; font-size: 10px; }
      .summary-chip strong { color: #294775; }
      .summary-caption { margin: 0; color: #8490a1; font-size: 10px; }
      .member { margin-top: 27px; break-inside: auto; }
      .member-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 11px; padding-bottom: 10px; border-bottom: 1px solid #e8edf4; }
      .member-heading h2 { margin: 0; color: #1d3353; font-size: 17px; }
      .member-heading p { margin: 3px 0 0; color: #8591a2; font-size: 10px; }
      .member-summary { max-width: 48%; color: #61738f; font-size: 10px; text-align: right; }
      .requirement { margin: 9px 0; padding: 12px 14px; border: 1px solid #e9eef5; border-radius: 8px; break-inside: avoid; }
      .requirement-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .project-name { color: #7083a0; font-size: 9px; font-weight: 650; }
      .requirement h3 { margin: 2px 0 0; color: #2b3f5e; font-size: 12px; }
      .status { flex: 0 0 auto; padding: 4px 8px; color: #3f6097; border-radius: 20px; background: #eef3fb; font-size: 9px; font-weight: 650; }
      .description, .context { margin: 8px 0 0; color: #66768d; font-size: 10px; }
      .context strong { color: #405573; }
      .updates { display: grid; gap: 5px; margin: 8px 0 0; padding-left: 17px; color: #455872; font-size: 10px; }
      .updates li::marker { color: #4e74bd; }
      .updates strong { color: #354d70; }
      .no-update, .no-assignments { margin: 8px 0 0; color: #8a96a6; font-size: 10px; font-style: italic; }
      footer { margin-top: 30px; padding-top: 10px; color: #9aa5b3; border-top: 1px solid #edf0f4; font-size: 9px; }
      @page { size: A4; margin: 14mm; }
      @media print {
        body { padding: 0; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .report { max-width: none; margin: 0; padding: 0; box-shadow: none; }
        .member { break-inside: auto; }
      }
      @media screen and (max-width: 640px) {
        body { padding: 10px; }
        .report { padding: 22px 18px; }
        .member-heading { flex-direction: column; }
        .member-summary { max-width: none; text-align: left; }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <header>
        <span class="eyebrow">Bitácora · resumen de jornada</span>
        <h1>Status de actividades - Equipo de Desarrollo</h1>
        <p class="report-date">Corte del ${escapeHtml(formatDate(reportDate))} · ${members.length} integrantes · ${projects.length} proyectos · ${requirements.length} requerimientos</p>
      </header>
      <section class="summary" aria-label="Resumen de estados">${statusSummary || '<span class="summary-chip">Sin requerimientos registrados</span>'}</section>
      <p class="summary-caption">${updateCount} ${updateCount === 1 ? "avance registrado" : "avances registrados"} en la bitácora para esta fecha. Los comentarios reflejan las notas registradas por el equipo.</p>
      ${memberSections || '<p class="no-assignments">No hay integrantes registrados en el equipo.</p>'}
      <footer>Reporte generado desde la bitácora de seguimiento. El estado actual y las notas del día se presentan por separado para conservar el contexto del registro.</footer>
    </main>
  </body>
</html>`;
}

export default function ProjectStatusReport({
  requirements,
  requirementLogs,
  projects,
  members,
}: {
  requirements: Requirement[];
  requirementLogs: RequirementLog[];
  projects: Project[];
  members: TeamMember[];
}) {
  const today = useCurrentDate();
  const [selectedReportDate, setSelectedReportDate] = useState("");
  const reportDate = selectedReportDate || today;
  const [error, setError] = useState("");

  function exportPdf() {
    setError("");
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setError("El navegador bloqueó la ventana del reporte. Permite las ventanas emergentes e inténtalo de nuevo.");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(createReportHtml({
      reportDate,
      requirements,
      requirementLogs,
      projects,
      members,
    }));
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  return (
    <div className="project-report-action">
      <label className="project-report-date">
        <span>Fecha del reporte</span>
        <input
          aria-label="Fecha de los avances para exportar"
          type="date"
          value={reportDate}
          max={today || undefined}
          onChange={(event) => setSelectedReportDate(event.target.value)}
        />
      </label>
      <button className="button button-outline" type="button" onClick={exportPdf} disabled={!reportDate}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <path d="M6 14h12v7H6zM17 12h.01" />
        </svg>
        Exportar PDF
      </button>
      {error && <span className="project-report-error" role="alert">{error}</span>}
    </div>
  );
}
