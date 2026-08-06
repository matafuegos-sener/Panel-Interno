import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Campos editables a mano desde Base Tracking -- el resto (rating, reviews,
// matrícula, fecha_inscripcion, oneroso, sanciones, fuente) es dato scrapeado
// u oficial (Ley 941/AGC), no se corrige a mano acá.
const CAMPOS_EDITABLES = [
  "nombre",
  "rubro",
  "tier",
  "ciudad",
  "direccion",
  "telefono",
  "whatsapp",
  "email",
  "website",
  "red_social",
  "notas",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const update: Record<string, string | null> = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (!(campo in body)) continue;
    const valor = body[campo];
    update[campo] = typeof valor === "string" ? valor.trim() || null : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("leads_base").update(update).eq("id", id).select("*").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { error } = await supabaseAdmin.from("leads_base").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
