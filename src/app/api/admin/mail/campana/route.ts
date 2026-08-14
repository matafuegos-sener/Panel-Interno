import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Campaña automática de mail (0013_campana_mail.sql): GET trae la activa
// (si hay), POST inicia una nueva (solo una a la vez), DELETE la cancela.
// El cron diario (/api/cron/mail-diario) es el único que la hace avanzar --
// esta ruta solo administra el registro, nunca manda mail.
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("campanas_mail")
    .select("*")
    .eq("estado", "activa")
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ campana: data ?? null }, { headers: { "Cache-Control": "no-store" } });
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

  const { data: existente } = await supabaseAdmin.from("campanas_mail").select("id").eq("estado", "activa").maybeSingle();
  if (existente) {
    return NextResponse.json({ error: "Ya hay una campaña automática activa -- cancelala antes de iniciar otra." }, { status: 409 });
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

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("campanas_mail").update({ estado: "cancelada" }).eq("id", id).eq("estado", "activa");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
