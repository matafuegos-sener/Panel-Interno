import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // select("*") a propósito, no una lista fija -- mismo motivo que
  // /api/admin/leads-base: si mañana se agrega una columna nueva a
  // `contactos`, este endpoint no se rompe hasta que la migración esté
  // aplicada.
  const { data, error } = await supabaseAdmin.from("contactos").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

// Alta manual de un contacto que no viene de ninguna base scrapeada --
// timbre del taller, llamada entrante, orgánico de la web. Siempre en
// `contactos` (nunca en `leads_base`, que es la base scrapeada) con
// `fuente: "manual"` -- mismo valor que ya usa el resto del panel para
// distinguir el origen.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  if (!nombre) {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("contactos")
    .insert({
      razon_social: nombre,
      tipo_perfil: typeof body.rubro === "string" && body.rubro.trim() ? body.rubro.trim() : null,
      telefono: typeof body.telefono === "string" && body.telefono.trim() ? body.telefono.trim() : null,
      mail_1: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
      contacto: typeof body.personaContacto === "string" && body.personaContacto.trim() ? body.personaContacto.trim() : null,
      fuente: "manual",
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
