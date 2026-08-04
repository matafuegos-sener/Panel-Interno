import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "sener_panel_admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "SENERPANEL2026";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? ADMIN_PASSWORD;

function sign(value: string): string {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export function checkPassword(password: string): boolean {
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function makeSessionToken(): string {
  return sign("admin-session");
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return token === makeSessionToken();
}
