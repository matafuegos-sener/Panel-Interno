import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const [{ data: interacciones, error: errInt }, { data: acciones, error: errAcc }] = await Promise.all([
    supabaseAdmin.from("interacciones").select("*").eq("contacto_id", id).order("fecha", { ascending: false }),
    supabaseAdmin.from("acciones").select("*").eq("contacto_id", id).eq("completada", false).order("fecha_ejecucion", { ascending: true }),
  ]);

  if (errInt || errAcc) {
    return NextResponse.json({ error: (errInt ?? errAcc)!.message }, { status: 500 });
  }
  return NextResponse.json(
    { interacciones: interacciones ?? [], acciones: acciones ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("contacto" in body)) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const contacto = typeof body.contacto === "string" ? body.contacto.trim() || null : null;
  const { error } = await supabaseAdmin.from("contactos").update({ contacto }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
