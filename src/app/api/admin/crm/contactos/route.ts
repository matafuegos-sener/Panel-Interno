import { NextResponse } from "next/server";
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
