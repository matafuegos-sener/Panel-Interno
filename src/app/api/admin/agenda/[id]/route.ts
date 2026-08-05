import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Marca completada/pendiente -- dispatcha a `acciones` o `agenda_eventos`
// según de dónde vino el evento (ver EventoAgenda.origen).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.completada !== "boolean" || (body.origen !== "accion" && body.origen !== "manual")) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const tabla = body.origen === "accion" ? "acciones" : "agenda_eventos";
  const { error } = await supabaseAdmin.from(tabla).update({ completada: body.completada }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
