import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AccionNueva, TablaOrigen, TIPO_A_CATEGORIA, TIPO_A_ESTADO_CRM } from "@/data/crm";

const REGISTRADO_POR = "Admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const tabla: TablaOrigen | null = body?.tabla === "contactos" || body?.tabla === "leads_base" ? body.tabla : null;
  if (
    !body ||
    typeof body !== "object" ||
    !tabla ||
    typeof body.tipo !== "string" ||
    typeof body.detalle !== "string" ||
    !body.detalle.trim()
  ) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const { data: nuevaInteraccion, error: errInt } = await supabaseAdmin
    .from("interacciones")
    .insert({
      contacto_id: id,
      tabla_origen: tabla,
      tipo: body.tipo,
      detalle: body.detalle.trim(),
      registrado_por: REGISTRADO_POR,
    })
    .select()
    .single();

  if (errInt) {
    return NextResponse.json({ error: errInt.message }, { status: 500 });
  }

  const accionesNuevas: AccionNueva[] = Array.isArray(body.acciones) ? body.acciones : [];
  const validAcciones = accionesNuevas
    .filter((a) => a?.descripcion?.trim() && a?.fecha_ejecucion)
    .map((a) => ({
      contacto_id: id,
      tabla_origen: tabla,
      interaccion_id: nuevaInteraccion.id,
      descripcion: a.descripcion.trim(),
      fecha_ejecucion: a.fecha_ejecucion,
      registrado_por: REGISTRADO_POR,
    }));

  // Dos ejes independientes, nunca se pisan entre sí (ver TIPO_A_CATEGORIA /
  // TIPO_A_ESTADO_CRM en crm.ts): `categoria` es el canal de contacto,
  // `estado_crm` es el seguimiento comercial. "llamar_luego" no tiene un
  // tipo de interacción propio -- sale de cargar una próxima acción, salvo
  // que este tipo ya tenga un estado más específico (ej: pidió cotización).
  const ahora = new Date().toISOString();
  const update: Record<string, string> = {};
  const categoriaNueva = TIPO_A_CATEGORIA[body.tipo];
  if (categoriaNueva) {
    update.categoria = categoriaNueva;
    update.categoria_actualizada_en = ahora;
  }
  const estadoCrmNuevo = TIPO_A_ESTADO_CRM[body.tipo] ?? (validAcciones.length ? "llamar_luego" : undefined);
  if (estadoCrmNuevo) {
    update.estado_crm = estadoCrmNuevo;
    update.estado_crm_actualizado_en = ahora;
  }
  if (Object.keys(update).length > 0) {
    await supabaseAdmin.from(tabla).update(update).eq("id", id);
  }

  if (validAcciones.length) {
    const { error: errAcc } = await supabaseAdmin.from("acciones").insert(validAcciones);
    if (errAcc) {
      return NextResponse.json({ error: "La interacción se guardó, pero las acciones no: " + errAcc.message }, { status: 500 });
    }
  }

  return NextResponse.json(nuevaInteraccion, { status: 201 });
}
