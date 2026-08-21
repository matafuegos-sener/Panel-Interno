import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Dispara desde casa-sener cuando alguien completa el calculador de
// presupuesto (ver casa-sener/src/app/api/quote/route.ts). Quien llama no
// tiene cookie de sesión del panel -- mismo mecanismo de autenticación que
// /api/cron/mail-diario (Bearer + secreto compartido, acá QUOTE_WEBHOOK_SECRET).
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.QUOTE_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.nombre !== "string" || !body.nombre.trim()) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("agenda_eventos").insert({
    tipo: "presupuesto_web",
    nota: construirNota(body),
    fecha: new Date().toISOString().slice(0, 10),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

function construirNota(d: Record<string, unknown>): string {
  const linea = (label: string, v: unknown) => (v ? `${label}: ${v}` : null);
  return [
    linea("Empresa", d.nombre),
    linea("Rubro", d.rubro),
    linea("Teléfono", d.telefono),
    linea("Email", d.email),
    linea("Servicio", [d.serviceLabel, d.extLabel, d.capacityLabel].filter(Boolean).join(" — ")),
    linea("Cantidad", d.quantity),
    linea("Total estimado", d.totalFmt),
  ]
    .filter(Boolean)
    .join("\n");
}
