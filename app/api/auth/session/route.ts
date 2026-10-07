import { cookies } from "next/headers";
import { readSession, sessionCookie } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(sessionCookie.name)?.value);
  return Response.json(session || { email: null });
}
