import { createHmac, timingSafeEqual } from "node:crypto";

const sessionCookieName = "bitacora_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

function getSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Define AUTH_SECRET antes de iniciar la aplicación en producción.");
  }
  if (process.env.BCP_ADMIN_PASSWORD) return process.env.BCP_ADMIN_PASSWORD;
  return "local-bitacora-session-secret-change-before-deploy";
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSession(email: string) {
  const payload = Buffer.from(
    JSON.stringify({ email, expiresAt: Date.now() + sessionLifetimeSeconds * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(token: string | undefined) {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const expectedSignature = Buffer.from(sign(payload));
  const actualSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof session.email !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }
    return { email: session.email };
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: sessionCookieName,
  maxAge: sessionLifetimeSeconds,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
