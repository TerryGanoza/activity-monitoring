import { cookies } from "next/headers";
import { sessionCookie } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookie.name);
  return Response.json({ success: true });
}
