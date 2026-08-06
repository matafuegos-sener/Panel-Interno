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
  const update: Record<string, string | boolean> = {};
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

  // Vigencia del matafuego: 1 año desde la venta (0010_vigencia_activo.sql).
  // "activo" nunca se marca a mano -- se enciende solo acá, y el filtro
  // Activo/Inactivo lo compara contra `vigencia_hasta` en cada consulta en
  // vez de depender de un cron que lo apague al año (no hay cron acá). El
  // recontacto a los 11 meses es una acción más, mismo circuito que "próxima
  // acción" del formulario -- ya aparece sola en "Pendiente con este
  // contacto" y en la Agenda, sin wiring nuevo.
  let accionVigencia: AccionNueva & { contacto_id: string; tabla_origen: TablaOrigen; interaccion_id: string; registrado_por: string } | null = null;
  if (estadoCrmNuevo === "pedido_entregado") {
    const fechaVenta = new Date();
    update.activo = true;
    const vigenciaHasta = new Date(fechaVenta);
    vigenciaHasta.setFullYear(vigenciaHasta.getFullYear() + 1);
    update.vigencia_hasta = vigenciaHasta.toISOString().slice(0, 10);

    const fechaRecontacto = new Date(fechaVenta);
    fechaRecontacto.setMonth(fechaRecontacto.getMonth() + 11);
    accionVigencia = {
      contacto_id: id,
      tabla_origen: tabla,
      interaccion_id: nuevaInteraccion.id,
      descripcion: "Recontactar por vencimiento de matafuego (vendido hace 11 meses) — ofrecer recarga",
      fecha_ejecucion: fechaRecontacto.toISOString().slice(0, 10),
      registrado_por: "Sistema",
    };
  }

  if (Object.keys(update).length > 0) {
    await supabaseAdmin.from(tabla).update(update).eq("id", id);
  }

  const accionesParaInsertar = accionVigencia ? [...validAcciones, accionVigencia] : validAcciones;
  if (accionesParaInsertar.length) {
    const { error: errAcc } = await supabaseAdmin.from("acciones").insert(accionesParaInsertar);
    if (errAcc) {
      return NextResponse.json({ error: "La interacción se guardó, pero las acciones no: " + errAcc.message }, { status: 500 });
    }
  }

  return NextResponse.json(nuevaInteraccion, { status: 201 });
}
