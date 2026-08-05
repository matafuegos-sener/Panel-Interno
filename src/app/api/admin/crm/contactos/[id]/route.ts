import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TablaOrigen } from "@/data/crm";

function leerTabla(req: NextRequest): TablaOrigen | null {
  const tabla = req.nextUrl.searchParams.get("tabla");
  return tabla === "contactos" || tabla === "leads_base" ? tabla : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const tabla = leerTabla(req);
  if (!tabla) {
    return NextResponse.json({ error: "Falta parámetro tabla" }, { status: 400 });
  }

  const [{ data: fila, error: errFila }, { data: interacciones, error: errInt }, { data: acciones, error: errAcc }] = await Promise.all([
    supabaseAdmin.from(tabla).select("*").eq("id", id).single(),
    supabaseAdmin.from("interacciones").select("*").eq("contacto_id", id).eq("tabla_origen", tabla).order("fecha", { ascending: false }),
    supabaseAdmin
      .from("acciones")
      .select("*")
      .eq("contacto_id", id)
      .eq("tabla_origen", tabla)
      .eq("completada", false)
      .order("fecha_ejecucion", { ascending: true }),
  ]);

  if (errFila || errInt || errAcc) {
    return NextResponse.json({ error: (errFila ?? errInt ?? errAcc)!.message }, { status: 500 });
  }
  return NextResponse.json(
    { fila, interacciones: interacciones ?? [], acciones: acciones ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// "contacto" (persona que atiende) ya existe en las dos tablas desde
// 0006_uniformar_base.sql -- se puede editar sin importar de dónde vino el
// contacto.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const tabla = leerTabla(req);
  if (!tabla) {
    return NextResponse.json({ error: "Falta parámetro tabla" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("contacto" in body)) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const contacto = typeof body.contacto === "string" ? body.contacto.trim() || null : null;
  const { error } = await supabaseAdmin.from(tabla).update({ contacto }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
