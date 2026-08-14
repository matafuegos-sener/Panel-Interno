import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Rampa de warm-up del dominio (ver build-log 2026-08-12). El 2026-08-11 se
// mandaron 60 mails en 4 tandas pegadas en menos de una hora -- muy por
// encima del tope seguro para un dominio sin historial de envío, y en
// ráfaga en vez de repartido. Estos dos límites existen para que ese
// patrón no se pueda repetir por accidente, no son arbitrarios: se
// recalculan a mano a medida que el dominio acumula historial limpio.
const TOPE_DIARIO: { desde: string; tope: number }[] = [
  { desde: "2026-08-12", tope: 40 },
  { desde: "2026-08-13", tope: 45 },
  { desde: "2026-08-14", tope: 50 },
];
const TOPE_DIARIO_ESTABLE = 50;
export const ESPACIADO_MINIMO_MINUTOS = 90;

// El webhook de Resend (src/app/api/webhooks/resend/route.ts) guarda
// rebotado/quejado por item -- ventana de 7 días con muestra mínima para no
// frenar por 1 rebote aislado sobre 2 envíos; una queja de spam frena
// siempre, sin importar el tamaño de la muestra.
const VENTANA_REBOTES_DIAS = 7;
const MUESTRA_MINIMA_TASA_REBOTE = 5;
const TASA_REBOTE_MAXIMA = 0.08;

export function topeDiarioHoy(hoy: string): number {
  const aplicable = [...TOPE_DIARIO].reverse().find((f) => f.desde <= hoy);
  return aplicable ? aplicable.tope : TOPE_DIARIO_ESTABLE;
}

export async function motivoFrenoPorRebotes(ahora: Date): Promise<string | null> {
  const desde = new Date(ahora.getTime() - VENTANA_REBOTES_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("tandas_envio_items")
    .select("resend_estado")
    .eq("estado", "enviado")
    .gte("enviado_en", desde)
    .in("resend_estado", ["entregado", "rebotado", "quejado"]);
  const conocidos = data ?? [];

  const quejas = conocidos.filter((f) => f.resend_estado === "quejado").length;
  if (quejas > 0) {
    return `Envío frenado: ${quejas} queja(s) de spam en los últimos ${VENTANA_REBOTES_DIAS} días. Revisar en Envíos activos antes de seguir mandando.`;
  }

  const rebotes = conocidos.filter((f) => f.resend_estado === "rebotado").length;
  if (conocidos.length < MUESTRA_MINIMA_TASA_REBOTE) return null;
  const tasa = rebotes / conocidos.length;
  if (tasa <= TASA_REBOTE_MAXIMA) return null;
  return `Envío frenado: ${rebotes}/${conocidos.length} mails rebotaron en los últimos ${VENTANA_REBOTES_DIAS} días (${Math.round(tasa * 100)}%, máximo ${Math.round(TASA_REBOTE_MAXIMA * 100)}%). Revisar la base antes de seguir mandando.`;
}

export interface CapacidadHoy {
  tope: number;
  yaEnviadosHoy: number;
  restante: number;
  ultimoEnviadoEn: string | null;
  minutosDesdeUltimo: number | null;
}

// tandas_envio_items es compartida entre mail y WhatsApp (mismo esquema,
// ver 0007_agenda_y_tandas.sql) -- sin el filtro por tandas_envio.tipo acá,
// una tanda de WhatsApp de hoy restaba del tope diario de mail sin haber
// mandado un solo mail (bug encontrado 2026-08-14).
export async function capacidadRestanteHoy(ahora: Date): Promise<CapacidadHoy> {
  const hoyISO = ahora.toISOString().slice(0, 10);
  const inicioHoy = `${hoyISO}T00:00:00.000Z`;
  const tope = topeDiarioHoy(hoyISO);

  const [{ count: yaEnviadosHoy }, { data: ultimoItem }] = await Promise.all([
    supabaseAdmin
      .from("tandas_envio_items")
      .select("id, tandas_envio!inner(tipo)", { count: "exact", head: true })
      .eq("estado", "enviado")
      .eq("tandas_envio.tipo", "mail")
      .gte("enviado_en", inicioHoy),
    supabaseAdmin
      .from("tandas_envio_items")
      .select("enviado_en, tandas_envio!inner(tipo)")
      .eq("estado", "enviado")
      .eq("tandas_envio.tipo", "mail")
      .order("enviado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const ultimoEnviadoEn = ultimoItem?.enviado_en ?? null;
  const minutosDesdeUltimo = ultimoEnviadoEn ? (ahora.getTime() - new Date(ultimoEnviadoEn).getTime()) / 60000 : null;
  const yaEnviados = yaEnviadosHoy ?? 0;

  return {
    tope,
    yaEnviadosHoy: yaEnviados,
    restante: Math.max(tope - yaEnviados, 0),
    ultimoEnviadoEn,
    minutosDesdeUltimo,
  };
}
