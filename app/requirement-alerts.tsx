"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Project, Requirement, TeamMember } from "@/lib/workspace";

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function useCurrentDate() {
  const [today, setToday] = useState("");

  useEffect(() => {
    const updateDate = () => setToday(localDate());
    updateDate();
    const interval = window.setInterval(updateDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return today;
}

export function getDaysUntilDeadline(deadline: string, today: string): number | null {
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;

  const [year, month, day] = deadline.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const deadlineTime = Date.UTC(year, month - 1, day);
  const todayTime = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const daysUntilDeadline = (deadlineTime - todayTime) / 86_400_000;

  return Number.isInteger(daysUntilDeadline) ? daysUntilDeadline : null;
}

export default function RequirementAlerts({
  requirements,
  members,
  projects,
}: {
  requirements: Requirement[];
  members: TeamMember[];
  projects: Project[];
}) {
  const today = useCurrentDate();
  const [dismissedDate, setDismissedDate] = useState("");
  const startingToday = today
    ? requirements.filter(
        (requirement) => requirement.startDate === today && requirement.status === "Abierto",
      )
    : [];

  if (!startingToday.length || dismissedDate === today) return null;

  return (
    <aside className="requirement-alerts" aria-label="Requerimientos que inician hoy" aria-live="polite">
      <div className="requirement-alerts-heading">
        <span className="requirement-alerts-icon"><span /></span>
        <div>
          <strong>Requerimientos que inician hoy</strong>
          <span>{startingToday.length} {startingToday.length === 1 ? "requerimiento abierto inicia" : "requerimientos abiertos inician"} hoy</span>
        </div>
        <button
          className="requirement-alerts-close"
          type="button"
          aria-label="Cerrar notificaciones de inicio de hoy"
          onClick={() => setDismissedDate(today)}
        >
          ×
        </button>
      </div>
      <div className="requirement-alerts-list">
        {startingToday.map((requirement) => {
          const project = projects.find((item) => item.id === requirement.projectId);
          const member = members.find((item) => item.id === requirement.assigneeId);

          return (
            <Link
              className="requirement-alert-card"
              href={`/projects/${encodeURIComponent(requirement.projectId)}`}
              key={requirement.id}
            >
              <span className="requirement-alert-card-title">{requirement.title}</span>
              <span className="requirement-alert-card-meta">
                <span>{project?.name || "Proyecto sin nombre"}</span>
                <span>{member?.name || "Sin responsable asignado"}</span>
              </span>
              <span className="requirement-alert-card-footer">
                <span>{requirement.ocdType}</span>
                <span className="requirement-alert-status">{requirement.status}</span>
                <span>QE: {requirement.qeAssignee || "Sin asignar"}</span>
                {requirement.deadline && <span>Deadline: {formatDate(requirement.deadline)}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
