import { cookies } from "next/headers";
import { readSession, sessionCookie } from "@/lib/auth";
import { readWorkspace, saveWorkspace } from "@/lib/database";
import {
  getRequirementStatuses,
  isRequirementType,
  REQUIREMENT_STATUSES,
} from "@/lib/workspace";
import type {
  LogEntry,
  Project,
  Requirement,
  RequirementLog,
  TeamMember,
  WorkspaceData,
} from "@/lib/workspace";

const memberStatuses = ["Activo", "En vacaciones", "Inactivo"];
const projectStatuses = ["En curso", "En planificación", "Completado"];
const requirementStatuses: readonly string[] = REQUIREMENT_STATUSES;

async function isAuthenticated() {
  const cookieStore = await cookies();
  return Boolean(readSession(cookieStore.get(sessionCookie.name)?.value));
}

function isText(value: unknown, maxLength = 200): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isMember(value: unknown): value is TeamMember {
  if (!value || typeof value !== "object") return false;
  const member = value as Record<string, unknown>;
  return (
    isText(member.id, 80) &&
    isText(member.name, 120) &&
    isText(member.role, 120) &&
    isText(member.email, 254) &&
    isText(member.area, 120) &&
    isText(member.initials, 4) &&
    isText(member.color, 24) &&
    isText(member.project, 120) &&
    isText(member.joinedAt, 10) &&
    typeof member.progress === "number" &&
    Number.isInteger(member.progress) &&
    member.progress >= 0 &&
    member.progress <= 100 &&
    typeof member.status === "string" &&
    memberStatuses.includes(member.status)
  );
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Record<string, unknown>;
  return (
    isText(project.id, 80) &&
    isText(project.name, 120) &&
    isText(project.description, 500) &&
    isText(project.dueDate, 10) &&
    isText(project.color, 24) &&
    typeof project.progress === "number" &&
    Number.isInteger(project.progress) &&
    project.progress >= 0 &&
    project.progress <= 100 &&
    typeof project.team === "number" &&
    Number.isInteger(project.team) &&
    project.team >= 0 &&
    typeof project.status === "string" &&
    projectStatuses.includes(project.status)
  );
}

function isLogEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    isText(entry.id, 80) &&
    isText(entry.memberId, 80) &&
    isText(entry.date, 10) &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    isText(entry.category, 40) &&
    isText(entry.note, 1000) &&
    entry.note.trim().length > 0
  );
}

function isRequirement(value: unknown): value is Requirement {
  if (!value || typeof value !== "object") return false;
  const requirement = value as Record<string, unknown>;
  const validations = requirement.validations;
  return (
    isText(requirement.id, 80) &&
    isText(requirement.projectId, 80) &&
    isText(requirement.title, 200) &&
    requirement.title.trim().length > 0 &&
    isText(requirement.description, 2000) &&
    isText(requirement.assigneeId, 80) &&
    isText(requirement.qeAssignee, 120) &&
    isText(requirement.ocdType, 80) &&
    isRequirementType(requirement.ocdType) &&
    typeof requirement.status === "string" &&
    getRequirementStatuses(requirement.ocdType).includes(
      requirement.status as Requirement["status"],
    ) &&
    isText(requirement.startDate, 10) &&
    (requirement.startDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(requirement.startDate)) &&
    isText(requirement.deadline, 10) &&
    (requirement.deadline === "" || /^\d{4}-\d{2}-\d{2}$/.test(requirement.deadline)) &&
    isText(requirement.passTime, 5) &&
    (requirement.passTime === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(requirement.passTime)) &&
    isText(requirement.registeredAt, 10) &&
    /^\d{4}-\d{2}-\d{2}$/.test(requirement.registeredAt) &&
    Boolean(validations) &&
    typeof validations === "object" &&
    ["functional", "performance", "owasp", "ethicalHacking"].every(
      (key) => typeof (validations as Record<string, unknown>)[key] === "boolean",
    )
  );
}

function isRequirementLog(value: unknown): value is RequirementLog {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    isText(entry.id, 80) &&
    isText(entry.requirementId, 80) &&
    isText(entry.memberId, 80) &&
    isText(entry.memberName, 120) &&
    isText(entry.date, 10) &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    typeof entry.status === "string" &&
    requirementStatuses.includes(entry.status) &&
    isText(entry.note, 2000) &&
    entry.note.trim().length > 0
  );
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }
  return Response.json(readWorkspace());
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }

  let workspace: WorkspaceData;
  try {
    workspace = await request.json();
  } catch {
    return Response.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
  }

  if (
    !workspace ||
    !Array.isArray(workspace.members) ||
    !Array.isArray(workspace.projects) ||
    !Array.isArray(workspace.logEntries) ||
    !Array.isArray(workspace.requirements) ||
    !Array.isArray(workspace.requirementLogs) ||
    workspace.members.length > 500 ||
    workspace.projects.length > 500 ||
    workspace.logEntries.length > 5000 ||
    workspace.requirements.length > 10000 ||
    workspace.requirementLogs.length > 50000 ||
    !workspace.members.every(isMember) ||
    !workspace.projects.every(isProject) ||
    !workspace.logEntries.every(isLogEntry) ||
    !workspace.requirements.every(isRequirement) ||
    !workspace.requirementLogs.every(isRequirementLog) ||
    new Set(workspace.members.map((member) => member.id)).size !== workspace.members.length ||
    new Set(workspace.projects.map((project) => project.id)).size !== workspace.projects.length ||
    new Set(workspace.logEntries.map((entry) => entry.id)).size !== workspace.logEntries.length ||
    new Set(workspace.requirements.map((requirement) => requirement.id)).size !==
      workspace.requirements.length ||
    new Set(workspace.requirementLogs.map((entry) => entry.id)).size !==
      workspace.requirementLogs.length ||
    workspace.logEntries.some(
      (entry) => !workspace.members.some((member) => member.id === entry.memberId),
    ) ||
    workspace.requirements.some(
      (requirement) =>
        !workspace.projects.some((project) => project.id === requirement.projectId) ||
        !workspace.members.some((member) => member.id === requirement.assigneeId),
    ) ||
    workspace.requirementLogs.some(
      (entry) => {
        const requirement = workspace.requirements.find(
          (item) => item.id === entry.requirementId,
        );
        return (
          !requirement ||
          !workspace.members.some((member) => member.id === entry.memberId) ||
          !getRequirementStatuses(requirement.ocdType).includes(entry.status)
        );
      },
    )
  ) {
    return Response.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
  }

  saveWorkspace(workspace);
  return Response.json({ success: true });
}
