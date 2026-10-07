import { cookies } from "next/headers";
import { createSession, sessionCookie } from "@/lib/auth";
import { verifyCredentials } from "@/lib/database";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
  }

  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.length > 254 ||
    body.password.length > 256
  ) {
    return Response.json({ error: "Ingresa un correo y una contraseña válidos." }, { status: 400 });
  }

  const email = verifyCredentials(body.email, body.password);
  if (!email) {
    return Response.json({ error: "El correo o la contraseña no son correctos." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, createSession(email), sessionCookie);
  return Response.json({ email });
}
