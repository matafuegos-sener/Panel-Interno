import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MensajeInput } from "@/data/mensajes";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const error = validate(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  const input = body as MensajeInput;

  const { data, error: errUpdate } = await supabaseAdmin
    .from("mensajes_predefinidos")
    .update({
      titulo: input.titulo.trim(),
      rubro: input.rubro.trim(),
      asunto: input.canal === "mail" ? (input.asunto ?? "").trim() : null,
      cuerpo: input.cuerpo.trim(),
    })
    .eq("id", id)
    .select()
    .single();

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 });
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
  const { error } = await supabaseAdmin.from("mensajes_predefinidos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

function validate(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Formato inválido";
  const b = body as Record<string, unknown>;
  if (b.canal !== "mail" && b.canal !== "whatsapp") return "Canal inválido";
  if (typeof b.titulo !== "string" || !b.titulo.trim()) return "Falta título";
  if (typeof b.rubro !== "string" || !b.rubro.trim()) return "Falta rubro";
  if (typeof b.cuerpo !== "string" || !b.cuerpo.trim()) return "Falta mensaje";
  if (b.canal === "mail" && (typeof b.asunto !== "string" || !b.asunto.trim())) return "Falta asunto";
  return null;
}
