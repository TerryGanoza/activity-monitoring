import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  calculateTeamMemberProgress,
  calculateProjectProgress,
  normalizeRequirementStatus,
  normalizeRequirementType,
} from "./workspace";

import type {
  LogEntry,
  Project,
  Requirement,
  RequirementLog,
  TeamMember,
  WorkspaceData,
} from "./workspace";

const databasePath = path.join(process.cwd(), ".data", "bitacora.sqlite");
const globalForDatabase = globalThis as typeof globalThis & {
  workspaceDatabase?: DatabaseSync;
};

const starterMembers: TeamMember[] = [
  {
    id: "tm-001",
    name: "Valeria Rojas",
    role: "Tech Lead",
    email: "valeria.rojas@empresa.com",
    area: "Plataformas",
    status: "Activo",
    initials: "VR",
    color: "violet",
    project: "Canales digitales",
    progress: 92,
    joinedAt: "2023-03-14",
  },
  {
    id: "tm-002",
    name: "Diego Mendoza",
    role: "Desarrollador backend",
    email: "diego.mendoza@empresa.com",
    area: "Ingeniería",
    status: "Activo",
    initials: "DM",
    color: "blue",
    project: "Billetera móvil",
    progress: 78,
    joinedAt: "2023-08-02",
  },
  {
    id: "tm-003",
    name: "Camila Torres",
    role: "Desarrolladora frontend",
    email: "camila.torres@empresa.com",
    area: "Experiencia digital",
    status: "Activo",
    initials: "CT",
    color: "orange",
    project: "Canales digitales",
    progress: 85,
    joinedAt: "2024-01-10",
  },
  {
    id: "tm-004",
    name: "Andrés Castillo",
    role: "QA Engineer",
    email: "andres.castillo@empresa.com",
    area: "Calidad",
    status: "En vacaciones",
    initials: "AC",
    color: "green",
    project: "Modernización core",
    progress: 64,
    joinedAt: "2022-11-21",
  },
  {
    id: "tm-005",
    name: "Lucía Fernández",
    role: "Product Designer",
    email: "lucia.fernandez@empresa.com",
    area: "Diseño",
    status: "Activo",
    initials: "LF",
    color: "pink",
    project: "Billetera móvil",
    progress: 88,
    joinedAt: "2024-05-06",
  },
  {
    id: "tm-006",
    name: "Mateo Salazar",
    role: "Desarrollador backend",
    email: "mateo.salazar@empresa.com",
    area: "Ingeniería",
    status: "Activo",
    initials: "MS",
    color: "cyan",
    project: "Modernización core",
    progress: 71,
    joinedAt: "2023-06-19",
  },
];

const starterProjects: Project[] = [
  {
    id: "pr-001",
    name: "Canales digitales",
    description: "Evolución de la experiencia web y canales de atención.",
    status: "En curso",
    progress: 72,
    team: 8,
    dueDate: "2026-11-30",
    color: "blue",
  },
  {
    id: "pr-002",
    name: "Billetera móvil",
    description: "Nuevas funcionalidades para pagos y transferencias.",
    status: "En curso",
    progress: 48,
    team: 6,
    dueDate: "2026-12-18",
    color: "orange",
  },
  {
    id: "pr-003",
    name: "Modernización core",
    description: "Actualización gradual de servicios y arquitectura.",
    status: "En planificación",
    progress: 24,
    team: 5,
    dueDate: "2027-02-12",
    color: "violet",
  },
  {
    id: "pr-004",
    name: "Portal de operaciones",
    description: "Herramientas internas para simplificar las operaciones.",
    status: "Completado",
    progress: 100,
    team: 4,
    dueDate: "2026-09-20",
    color: "green",
  },
];

const starterLogEntries: LogEntry[] = [
  {
    id: "log-001",
    memberId: "tm-001",
    date: "2026-10-06",
    category: "Avance",
    note: "Alineó al equipo con el plan de entrega de la nueva experiencia digital.",
  },
  {
    id: "log-002",
    memberId: "tm-002",
    date: "2026-10-05",
    category: "Avance",
    note: "Completó la integración de los servicios de transferencias.",
  },
  {
    id: "log-003",
    memberId: "tm-004",
    date: "2026-10-02",
    category: "Acuerdo",
    note: "Dejó coordinada la validación de calidad para el siguiente sprint.",
  },
];

const starterRequirements: Requirement[] = [
  {
    id: "req-001",
    projectId: "pr-001",
    title: "API-PYM-001 · Consulta de clientes",
    description: "Permitir consultar la información de clientes para el flujo de originación.",
    assigneeId: "tm-002",
    qeAssignee: "Eugenia Villanueva",
    ocdType: "Deploy Go",
    status: "Desarrollo",
    validations: {
      functional: true,
      performance: false,
      owasp: false,
      ethicalHacking: false,
    },
    deadline: "2026-10-29",
    startDate: "",
    passTime: "",
    registeredAt: "2026-10-05",
  },
  {
    id: "req-002",
    projectId: "pr-001",
    title: "API-PYM-002 · Validación de solicitudes",
    description: "Validar los datos obligatorios antes de enviar una solicitud.",
    assigneeId: "tm-003",
    qeAssignee: "Eugenia Villanueva",
    ocdType: "Deploy Go",
    status: "Desarrollo",
    validations: {
      functional: false,
      performance: false,
      owasp: false,
      ethicalHacking: false,
    },
    deadline: "2026-11-05",
    startDate: "",
    passTime: "",
    registeredAt: "2026-10-06",
  },
];

const starterRequirementLogs: RequirementLog[] = [
  {
    id: "reqlog-001",
    requirementId: "req-001",
    memberId: "tm-002",
    memberName: "Diego Mendoza",
    date: "2026-10-06",
    status: "Desarrollo",
    note: "Terminé el endpoint principal y estoy validando los escenarios de respuesta.",
  },
];

function getDatabase() {
  if (globalForDatabase.workspaceDatabase) return globalForDatabase.workspaceDatabase;

  mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT NOT NULL,
      area TEXT NOT NULL,
      status TEXT NOT NULL,
      initials TEXT NOT NULL,
      color TEXT NOT NULL,
      project TEXT NOT NULL,
      progress INTEGER NOT NULL,
      joined_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL,
      team INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS log_entries (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      note TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      assignee_id TEXT NOT NULL,
      qe_assignee TEXT NOT NULL,
      ocd_type TEXT NOT NULL,
      status TEXT NOT NULL,
      validations TEXT NOT NULL,
      start_date TEXT NOT NULL DEFAULT '',
      deadline TEXT NOT NULL,
      pass_time TEXT NOT NULL,
      registered_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requirement_logs (
      id TEXT PRIMARY KEY,
      requirement_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL
    );
  `);
  const requirementColumns = database
    .prepare("PRAGMA table_info(requirements)")
    .all() as { name: string }[];
  if (!requirementColumns.some((column) => column.name === "start_date")) {
    database.exec("ALTER TABLE requirements ADD COLUMN start_date TEXT NOT NULL DEFAULT ''");
  }

  const adminEmail = process.env.BCP_ADMIN_EMAIL?.trim().toLowerCase() || "admin@bcp.local";
  const adminPassword =
    process.env.BCP_ADMIN_PASSWORD ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "BcpLocal2026!");

  if (!adminPassword) {
    throw new Error("Define BCP_ADMIN_PASSWORD antes de iniciar la aplicación en producción.");
  }

  const userCount = database.prepare("SELECT COUNT(*) AS count FROM users").get() as {
    count: number;
  };
  if (userCount.count === 0) {
    const salt = randomBytes(16).toString("hex");
    const passwordHash = scryptSync(adminPassword, salt, 64).toString("hex");
    database
      .prepare("INSERT INTO users (email, salt, password_hash) VALUES (?, ?, ?)")
      .run(adminEmail, salt, passwordHash);
  }

  const memberCount = database.prepare("SELECT COUNT(*) AS count FROM members").get() as {
    count: number;
  };
  if (memberCount.count === 0) {
    const insertMember = database.prepare(`
      INSERT INTO members (id, name, role, email, area, status, initials, color, project, progress, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const member of starterMembers) {
      insertMember.run(
        member.id,
        member.name,
        member.role,
        member.email,
        member.area,
        member.status,
        member.initials,
        member.color,
        member.project,
        member.progress,
        member.joinedAt,
      );
    }
  }

  const projectCount = database.prepare("SELECT COUNT(*) AS count FROM projects").get() as {
    count: number;
  };
  if (projectCount.count === 0) {
    const insertProject = database.prepare(`
      INSERT INTO projects (id, name, description, status, progress, team, due_date, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const project of starterProjects) {
      insertProject.run(
        project.id,
        project.name,
        project.description,
        project.status,
        project.progress,
        project.team,
        project.dueDate,
        project.color,
      );
    }
  }

  const logCount = database.prepare("SELECT COUNT(*) AS count FROM log_entries").get() as {
    count: number;
  };
  if (logCount.count === 0) {
    const insertEntry = database.prepare(`
      INSERT INTO log_entries (id, member_id, date, category, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const entry of starterLogEntries) {
      insertEntry.run(entry.id, entry.memberId, entry.date, entry.category, entry.note);
    }
  }

  const requirementCount = database.prepare("SELECT COUNT(*) AS count FROM requirements").get() as {
    count: number;
  };
  if (requirementCount.count === 0) {
    const insertRequirement = database.prepare(`
      INSERT INTO requirements
        (id, project_id, title, description, assignee_id, qe_assignee, ocd_type, status, validations, start_date, deadline, pass_time, registered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const requirement of starterRequirements) {
      insertRequirement.run(
        requirement.id,
        requirement.projectId,
        requirement.title,
        requirement.description,
        requirement.assigneeId,
        requirement.qeAssignee,
        requirement.ocdType,
        requirement.status,
        JSON.stringify(requirement.validations),
        requirement.startDate,
        requirement.deadline,
        requirement.passTime,
        requirement.registeredAt,
      );
    }
  }

  const requirementLogCount = database
    .prepare("SELECT COUNT(*) AS count FROM requirement_logs")
    .get() as { count: number };
  if (requirementLogCount.count === 0) {
    const insertLog = database.prepare(`
      INSERT INTO requirement_logs
        (id, requirement_id, member_id, member_name, date, status, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const entry of starterRequirementLogs) {
      insertLog.run(
        entry.id,
        entry.requirementId,
        entry.memberId,
        entry.memberName,
        entry.date,
        entry.status,
        entry.note,
      );
    }
  }

  globalForDatabase.workspaceDatabase = database;
  return database;
}

export function verifyCredentials(email: string, password: string) {
  const user = getDatabase()
    .prepare("SELECT email, salt, password_hash FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as
    | { email: string; salt: string; password_hash: string }
    | undefined;

  if (!user) return null;
  const actualHash = scryptSync(password, user.salt, 64);
  const expectedHash = Buffer.from(user.password_hash, "hex");
  if (actualHash.length !== expectedHash.length) return null;

  return timingSafeEqual(actualHash, expectedHash) ? user.email : null;
}

export function readWorkspace(): WorkspaceData {
  const database = getDatabase();
  const members = database.prepare(`
    SELECT id, name, role, email, area, status, initials, color, project, progress, joined_at AS joinedAt
    FROM members ORDER BY name
  `).all() as TeamMember[];
  const projects = database.prepare(`
    SELECT id, name, description, status, progress, team, due_date AS dueDate, color
    FROM projects ORDER BY name
  `).all() as Project[];
  const logEntries = database.prepare(`
    SELECT id, member_id AS memberId, date, category, note
    FROM log_entries ORDER BY date DESC, id DESC
  `).all() as LogEntry[];
  const rawRequirements = database.prepare(`
    SELECT id, project_id AS projectId, title, description, assignee_id AS assigneeId,
      qe_assignee AS qeAssignee, ocd_type AS ocdType, status, validations,
      start_date AS startDate, deadline, pass_time AS passTime, registered_at AS registeredAt
    FROM requirements ORDER BY registered_at DESC, title
  `).all() as (Omit<Requirement, "validations"> & { validations: string })[];
  const requirements = rawRequirements.map((requirement) => ({
    ...requirement,
    ocdType: normalizeRequirementType(requirement.ocdType),
    status: normalizeRequirementStatus(
      requirement.status,
      normalizeRequirementType(requirement.ocdType),
    ),
    validations: JSON.parse(requirement.validations) as Requirement["validations"],
  }));
  const rawRequirementLogs = database.prepare(`
    SELECT id, requirement_id AS requirementId, member_id AS memberId, member_name AS memberName,
      date, status, note
    FROM requirement_logs ORDER BY date DESC, id DESC
  `).all() as RequirementLog[];
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const requirementLogs = rawRequirementLogs.map((entry) => ({
    ...entry,
    status: normalizeRequirementStatus(
      entry.status,
      requirementsById.get(entry.requirementId)?.ocdType || "",
    ),
  }));
  const projectsWithCalculatedProgress = projects.map((project) => ({
    ...project,
    progress: calculateProjectProgress(
      requirements.filter((requirement) => requirement.projectId === project.id),
    ),
  }));
  const membersWithCalculatedProgress = members.map((member) => ({
    ...member,
    progress: calculateTeamMemberProgress(requirements, member.id),
  }));
  return {
    members: membersWithCalculatedProgress,
    projects: projectsWithCalculatedProgress,
    logEntries,
    requirements,
    requirementLogs,
  };
}

export function saveWorkspace(workspace: WorkspaceData) {
  const database = getDatabase();
  const projectProgress = new Map(
    workspace.projects.map((project) => [
      project.id,
      calculateProjectProgress(
        workspace.requirements.filter((requirement) => requirement.projectId === project.id),
      ),
    ]),
  );
  const memberProgress = new Map(
    workspace.members.map((member) => [
      member.id,
      calculateTeamMemberProgress(workspace.requirements, member.id),
    ]),
  );
  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM requirement_logs; DELETE FROM requirements; DELETE FROM members; DELETE FROM projects; DELETE FROM log_entries;");
    const insertMember = database.prepare(`
      INSERT INTO members (id, name, role, email, area, status, initials, color, project, progress, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const member of workspace.members) {
      insertMember.run(
        member.id,
        member.name,
        member.role,
        member.email,
        member.area,
        member.status,
        member.initials,
        member.color,
        member.project,
        memberProgress.get(member.id) ?? 0,
        member.joinedAt,
      );
    }
    const insertProject = database.prepare(`
      INSERT INTO projects (id, name, description, status, progress, team, due_date, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const project of workspace.projects) {
      insertProject.run(
        project.id,
        project.name,
        project.description,
        project.status,
        projectProgress.get(project.id) ?? 0,
        project.team,
        project.dueDate,
        project.color,
      );
    }
    const insertEntry = database.prepare(`
      INSERT INTO log_entries (id, member_id, date, category, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const entry of workspace.logEntries) {
      insertEntry.run(entry.id, entry.memberId, entry.date, entry.category, entry.note);
    }
    const insertRequirement = database.prepare(`
      INSERT INTO requirements
        (id, project_id, title, description, assignee_id, qe_assignee, ocd_type, status, validations, start_date, deadline, pass_time, registered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const requirement of workspace.requirements) {
      insertRequirement.run(
        requirement.id,
        requirement.projectId,
        requirement.title,
        requirement.description,
        requirement.assigneeId,
        requirement.qeAssignee,
        requirement.ocdType,
        requirement.status,
        JSON.stringify(requirement.validations),
        requirement.startDate,
        requirement.deadline,
        requirement.passTime,
        requirement.registeredAt,
      );
    }
    const insertRequirementLog = database.prepare(`
      INSERT INTO requirement_logs
        (id, requirement_id, member_id, member_name, date, status, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const entry of workspace.requirementLogs) {
      insertRequirementLog.run(
        entry.id,
        entry.requirementId,
        entry.memberId,
        entry.memberName,
        entry.date,
        entry.status,
        entry.note,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
