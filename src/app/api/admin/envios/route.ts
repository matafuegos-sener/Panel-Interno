import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TandaEnvio } from "@/data/tandas";

const LIMITE = 15;

// Lista las últimas tandas de envío (mail/WhatsApp), en curso o recién
// completadas -- consumido por el widget de Agenda y por "Envíos activos"
// en el menú, ambos con poll (ver useTandasEnvio).
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: tandas, error } = await supabaseAdmin
    .from("tandas_envio")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(LIMITE);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const idsPlantillas = Array.from(
    new Set((tandas ?? []).map((t) => t.plantilla_id).filter((id): id is string => Boolean(id)))
  );
  const { data: plantillas } = idsPlantillas.length
    ? await supabaseAdmin.from("mensajes_predefinidos").select("id, titulo").in("id", idsPlantillas)
    : { data: [] as { id: string; titulo: string }[] };
  const mapaPlantillas = new Map((plantillas ?? []).map((p) => [p.id as string, p.titulo as string]));

  // Cuenta rebotes/quejas por tanda para el badge del listado, sin agregar
  // una columna nueva a tandas_envio -- con hasta 15 tandas x 25 items esto
  // es liviano, no hace falta un RPC agrupado.
  const idsTandas = (tandas ?? []).map((t) => t.id);
  const { data: problemas } = idsTandas.length
    ? await supabaseAdmin
        .from("tandas_envio_items")
        .select("tanda_id")
        .in("tanda_id", idsTandas)
        .in("resend_estado", ["rebotado", "quejado"])
    : { data: [] as { tanda_id: string }[] };
  const conteoProblemas = new Map<string, number>();
  for (const p of problemas ?? []) {
    conteoProblemas.set(p.tanda_id, (conteoProblemas.get(p.tanda_id) ?? 0) + 1);
  }

  const resultado: TandaEnvio[] = (tandas ?? []).map((t) => ({
    id: t.id,
    tipo: t.tipo,
    estado: t.estado,
    total: t.total,
    enviados: t.enviados,
    fallidos: t.fallidos,
    asunto: t.asunto,
    plantillaTitulo: t.plantilla_id ? mapaPlantillas.get(t.plantilla_id) ?? null : null,
    creadoEn: t.creado_en,
    completadoEn: t.completado_en,
    conProblemas: conteoProblemas.get(t.id) ?? 0,
  }));

  return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
}
