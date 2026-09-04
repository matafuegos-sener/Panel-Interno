import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { capacidadRestanteHoy } from "@/lib/mailTope";

// Campaña automática de mail (0013_campana_mail.sql, pausar agregado en
// 0018_campana_mail_pausar.sql): GET trae la activa o pausada (si hay) con el
// cupo de hoy -- rápido, no recorre la base. El progreso real (cuánto falta)
// vive aparte en /api/admin/mail/campana/progreso porque recorrer toda la
// base filtrada (miles de filas) es lento y no hace falta bloquear con eso
// ni la aparición de la fila ni pausar/reanudar. POST inicia una nueva
// (solo si no hay otra activa/pausada), PATCH pausa/reanuda, DELETE frena
// (terminal, `?modo=eliminar` la borra directo en vez de dejarla cancelada).
// El cron diario (/api/cron/mail-diario) es el único que la hace avanzar --
// esta ruta solo administra el registro, nunca manda mail.
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("campanas_mail")
    .select("*")
    .in("estado", ["activa", "pausada"])
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const cupoHoy = await capacidadRestanteHoy(new Date());
  return NextResponse.json({ campana: data ?? null, cupoHoy }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.asunto !== "string" ||
    !body.asunto.trim() ||
    typeof body.cuerpo !== "string" ||
    !body.cuerpo.trim() ||
    typeof body.filtro !== "object" ||
    body.filtro === null
  ) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const { data: existente } = await supabaseAdmin.from("campanas_mail").select("id").in("estado", ["activa", "pausada"]).maybeSingle();
  if (existente) {
    return NextResponse.json({ error: "Ya hay una campaña automática activa o pausada -- frenala o eliminala antes de iniciar otra." }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("campanas_mail")
    .insert({ filtro: body.filtro, asunto: body.asunto.trim(), cuerpo: body.cuerpo })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ campana: data });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const id = body?.id;
  const accion = body?.accion;
  if (typeof id !== "string" || (accion !== "pausar" && accion !== "reanudar")) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const desde = accion === "pausar" ? "activa" : "pausada";
  const hacia = accion === "pausar" ? "pausada" : "activa";
  const { data, error } = await supabaseAdmin
    .from("campanas_mail")
    .update({ estado: hacia })
    .eq("id", id)
    .eq("estado", desde)
    .select()
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: `La campaña no está en estado "${desde}"` }, { status: 409 });
  }
  return NextResponse.json({ campana: data });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  if (req.nextUrl.searchParams.get("modo") === "eliminar") {
    const { error } = await supabaseAdmin.from("campanas_mail").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin
    .from("campanas_mail")
    .update({ estado: "cancelada" })
    .eq("id", id)
    .in("estado", ["activa", "pausada"]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
