export type MemberStatus = "Activo" | "En vacaciones" | "Inactivo";
export type ProjectStatus = "En curso" | "En planificación" | "Completado";

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  email: string;
  area: string;
  status: MemberStatus;
  initials: string;
  color: string;
  project: string;
  progress: number;
  joinedAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  team: number;
  dueDate: string;
  color: string;
};

export type LogEntry = {
  id: string;
  memberId: string;
  date: string;
  category: string;
  note: string;
};

export const REQUIREMENT_TYPES = ["OCD Normal", "Deploy Go"] as const;

export const REQUIREMENT_STATUSES = [
  "Abierto",
  "Desarrollo",
  "Congelamiento",
  "Reversión",
  "Recongelamiento",
  "Gestión de pase",
  "Done",
  "Bloqueado",
] as const;

export const DEPLOY_GO_STATUSES = [
  "Abierto",
  "Desarrollo",
  "Congelamiento",
  "Gestión de pase",
  "Done",
  "Bloqueado",
] as const;

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export function isRequirementType(value: string): value is RequirementType {
  return REQUIREMENT_TYPES.some((type) => type.toLowerCase() === value.trim().toLowerCase());
}

export function normalizeRequirementType(value: string): RequirementType {
  return isDeployGoType(value) ? "Deploy Go" : "OCD Normal";
}

export function isDeployGoType(ocdType: string) {
  return ocdType.trim().toLowerCase() === "deploy go";
}

export function getRequirementStatuses(ocdType: string): readonly RequirementStatus[] {
  return isDeployGoType(ocdType) ? DEPLOY_GO_STATUSES : REQUIREMENT_STATUSES;
}

export function normalizeRequirementStatus(status: string, ocdType: string): RequirementStatus {
  const legacyStatuses: Record<string, RequirementStatus> = {
    Pendiente: "Desarrollo",
    "En curso": "Desarrollo",
    "En revisión": "Gestión de pase",
    Completado: "Done",
  };
  const mappedStatus = legacyStatuses[status] || status;
  const allowedStatuses = getRequirementStatuses(ocdType);
  return allowedStatuses.find((allowedStatus) => allowedStatus === mappedStatus) || "Desarrollo";
}

export function calculateProjectProgress(requirements: readonly Requirement[]): number {
  if (requirements.length === 0) return 0;
  const totalProgress = requirements.reduce((total, requirement) => {
    if (requirement.status === "Done") return total + 1;
    if (requirement.status === "Abierto" || requirement.status === "Bloqueado") return total;
    return total + 0.5;
  }, 0);
  return Math.round((totalProgress / requirements.length) * 100);
}

export function calculateTeamMemberProgress(
  requirements: readonly Requirement[],
  memberId: string,
): number {
  return calculateProjectProgress(
    requirements.filter((requirement) => requirement.assigneeId === memberId),
  );
}

export type Requirement = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assigneeId: string;
  qeAssignee: string;
  ocdType: string;
  status: RequirementStatus;
  validations: {
    functional: boolean;
    performance: boolean;
    owasp: boolean;
    ethicalHacking: boolean;
  };
  startDate: string;
  deadline: string;
  passTime: string;
  registeredAt: string;
};

export type RequirementLog = {
  id: string;
  requirementId: string;
  memberId: string;
  memberName: string;
  date: string;
  status: RequirementStatus;
  note: string;
};

export type WorkspaceData = {
  members: TeamMember[];
  projects: Project[];
  logEntries: LogEntry[];
  requirements: Requirement[];
  requirementLogs: RequirementLog[];
};
