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
  }));

  return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
}
