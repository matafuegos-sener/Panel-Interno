import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { MAIL_FROM } from "@/lib/resend";

// Chequeo de solo lectura (no manda nada) -- confirma que RESEND_API_KEY es
// válida y que el dominio de MAIL_FROM está verificado para envío, antes de
// usar el sistema con contactos reales.
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Falta RESEND_API_KEY en .env.local" }, { status: 200 });
  }

  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: data?.message || `Resend respondió ${res.status}` });
  }

  const dominioFrom = MAIL_FROM.match(/@([^\s>]+)/)?.[1] ?? "";
  const dominio = (data?.data ?? []).find((d: { name: string }) => d.name === dominioFrom);

  return NextResponse.json({
    ok: true,
    apiKeyValida: true,
    mailFrom: MAIL_FROM,
    dominio: dominioFrom,
    dominioEncontrado: !!dominio,
    dominioVerificado: dominio?.status === "verified",
    estadoDominio: dominio?.status ?? "no encontrado en la cuenta de Resend",
  });
}
