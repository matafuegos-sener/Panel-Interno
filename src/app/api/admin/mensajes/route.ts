import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Canal, MensajeInput } from "@/data/mensajes";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const canal = req.nextUrl.searchParams.get("canal") as Canal | null;
  if (canal !== "mail" && canal !== "whatsapp") {
    return NextResponse.json({ error: "Falta parámetro canal" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("mensajes_predefinidos")
    .select("*")
    .eq("canal", canal)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const error = validate(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  const input = body as MensajeInput;

  const { data, error: errInsert } = await supabaseAdmin
    .from("mensajes_predefinidos")
    .insert({
      canal: input.canal,
      titulo: input.titulo.trim(),
      rubro: input.rubro.trim(),
      asunto: input.canal === "mail" ? (input.asunto ?? "").trim() : null,
      cuerpo: input.cuerpo.trim(),
    })
    .select()
    .single();

  if (errInsert) {
    return NextResponse.json({ error: errInsert.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
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
