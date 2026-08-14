import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarMail, MAIL_FROM_PROSPECCION } from "@/lib/resend";
import { reemplazarVariables, textoAHtml, textoAPlano } from "@/lib/plantillas";
import { TablaOrigen, CATEGORIA_PROSPECTO_CERO } from "@/data/crm";

export interface ItemTanda {
  id: string;
  tabla: TablaOrigen;
}

type FilaContacto = Record<string, string | boolean | null>;

const COLUMNA_MAIL: Record<TablaOrigen, string> = { contactos: "mail_1", leads_base: "email" };
const COLUMNAS_NOMBRE: Record<TablaOrigen, string> = { contactos: "razon_social, nombre_comercial", leads_base: "nombre" };

function nombreDeFila(tabla: TablaOrigen, fila: FilaContacto): string {
  if (tabla === "leads_base") return (fila.nombre as string) || "";
  return (fila.razon_social as string) || (fila.nombre_comercial as string) || "";
}

async function traerFilas(tabla: TablaOrigen, ids: string[]): Promise<Map<string, FilaContacto>> {
  const mapa = new Map<string, FilaContacto>();
  if (ids.length === 0) return mapa;
  const { data } = await supabaseAdmin
    .from(tabla)
    .select(`id, mail_enviado, mail_bloqueado, categoria, ${COLUMNA_MAIL[tabla]}, ${COLUMNAS_NOMBRE[tabla]}`)
    .in("id", ids);
  (data ?? []).forEach((fila) => {
    const filaTipada = fila as unknown as FilaContacto;
    mapa.set(filaTipada.id as string, filaTipada);
  });
  return mapa;
}

export interface ResultadoEnvioMail {
  tandaId: string;
  enviados: ItemTanda[];
  fallidos: { id: string; tabla: TablaOrigen; motivo: string }[];
}

// Envía uno por uno (nunca CC/BCC, ver reglas de email del CLAUDE.md
// global) y marca mail_enviado=true en la tabla de origen de cada contacto
// para que no se repita en la próxima tanda. Persiste la tanda en
// tandas_envio/tandas_envio_items y va actualizando el progreso item por
// item mientras el loop corre, así un poll desde la Agenda la ve avanzar en
// vivo. Usada tanto por el envío manual (espaciadoMs=0, tanda chica, ya la
// dispara Baltasar a mano) como por el cron diario (espaciadoMs>0, tanda
// grande sin supervisión -- ver mail-diario/route.ts).
export async function ejecutarEnvioMail(params: {
  asunto: string;
  cuerpo: string;
  items: ItemTanda[];
  espaciadoMs?: number;
}): Promise<ResultadoEnvioMail> {
  const { asunto, cuerpo, items, espaciadoMs = 0 } = params;

  const idsContactos = items.filter((i) => i.tabla === "contactos").map((i) => i.id);
  const idsTracking = items.filter((i) => i.tabla === "leads_base").map((i) => i.id);
  const [filasContactos, filasTracking] = await Promise.all([
    traerFilas("contactos", idsContactos),
    traerFilas("leads_base", idsTracking),
  ]);
  const filasPorTabla: Record<TablaOrigen, Map<string, FilaContacto>> = {
    contactos: filasContactos,
    leads_base: filasTracking,
  };

  const { data: tanda, error: errTanda } = await supabaseAdmin
    .from("tandas_envio")
    .insert({ tipo: "mail", total: items.length, asunto })
    .select()
    .single();
  if (errTanda || !tanda) {
    throw new Error("No se pudo crear el registro de la tanda");
  }

  // Filtra tablas inválidas antes de insertar -- tandas_envio_items tiene un
  // check constraint sobre tabla_origen, y un insert masivo con una sola fila
  // fuera del check tira abajo el insert entero.
  const itemsParaInsertar = items
    .map((item, orden) => ({ item, orden }))
    .filter(({ item }) => item.tabla === "contactos" || item.tabla === "leads_base")
    .map(({ item, orden }) => {
      const fila = filasPorTabla[item.tabla]?.get(item.id);
      return {
        tanda_id: tanda.id,
        contacto_id: item.id,
        tabla_origen: item.tabla,
        nombre: (fila && nombreDeFila(item.tabla, fila)) || "(sin nombre)",
        orden,
      };
    });
  await supabaseAdmin.from("tandas_envio_items").insert(itemsParaInsertar);

  const enviados: ItemTanda[] = [];
  const fallidos: { id: string; tabla: TablaOrigen; motivo: string }[] = [];

  async function marcarItem(item: ItemTanda, estado: "enviado" | "fallido", motivo?: string, resendId?: string) {
    await supabaseAdmin
      .from("tandas_envio_items")
      .update({
        estado,
        motivo: motivo ?? null,
        ...(resendId ? { resend_id: resendId, enviado_en: new Date().toISOString() } : {}),
      })
      .eq("tanda_id", tanda.id)
      .eq("contacto_id", item.id)
      .eq("tabla_origen", item.tabla);
    await supabaseAdmin.from("tandas_envio").update({ enviados: enviados.length, fallidos: fallidos.length }).eq("id", tanda.id);
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0 && espaciadoMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, espaciadoMs));
    }

    const tabla = item.tabla === "contactos" || item.tabla === "leads_base" ? item.tabla : null;
    if (!tabla) {
      fallidos.push({ id: item.id, tabla: item.tabla, motivo: "Tabla inválida" });
      await marcarItem(item, "fallido", "Tabla inválida");
      continue;
    }

    const fila = filasPorTabla[tabla].get(item.id);
    if (!fila) {
      fallidos.push({ id: item.id, tabla, motivo: "No se encontró el contacto" });
      await marcarItem(item, "fallido", "No se encontró el contacto");
      continue;
    }
    const email = fila[COLUMNA_MAIL[tabla]] as string | null;
    if (!email) {
      fallidos.push({ id: item.id, tabla, motivo: "Sin email" });
      await marcarItem(item, "fallido", "Sin email");
      continue;
    }
    if (fila.mail_enviado) {
      fallidos.push({ id: item.id, tabla, motivo: "Ya se le había enviado" });
      await marcarItem(item, "fallido", "Ya se le había enviado");
      continue;
    }
    // Casilla bloqueada por rebote duro o queja de spam (ver
    // webhooks/resend/route.ts) -- barrera dura del lado servidor, aunque el
    // filtro de origen (EnviosMailView.tsx / mail-diario/route.ts) no lo
    // haya excluido.
    if (fila.mail_bloqueado) {
      fallidos.push({ id: item.id, tabla, motivo: "Casilla de mail bloqueada (rebote o spam)" });
      await marcarItem(item, "fallido", "Casilla de mail bloqueada (rebote o spam)");
      continue;
    }
    // Resguardo del lado del servidor -- nunca mandar un mail masivo a un
    // contacto que ya se está trabajando, sin importar lo que haya filtrado
    // el cliente (ver conversación 2026-08-05).
    if (fila.categoria !== CATEGORIA_PROSPECTO_CERO) {
      fallidos.push({ id: item.id, tabla, motivo: "Ya no es un Prospecto Cero" });
      await marcarItem(item, "fallido", "Ya no es un Prospecto Cero");
      continue;
    }

    const nombre = nombreDeFila(tabla, fila);
    const asuntoFinal = textoAPlano(reemplazarVariables(asunto, nombre));
    const cuerpoFinal = reemplazarVariables(cuerpo, nombre);
    const resultado = await enviarMail({
      to: email,
      subject: asuntoFinal,
      text: textoAPlano(cuerpoFinal),
      html: textoAHtml(cuerpoFinal),
      from: MAIL_FROM_PROSPECCION,
    });
    if (!resultado.ok) {
      fallidos.push({ id: item.id, tabla, motivo: resultado.error || "Resend rechazó el envío" });
      await marcarItem(item, "fallido", resultado.error || "Resend rechazó el envío");
      continue;
    }

    const ahoraEnvio = new Date().toISOString();
    await supabaseAdmin
      .from(tabla)
      .update({ mail_enviado: true, mail_enviado_en: ahoraEnvio })
      .eq("id", item.id);
    enviados.push({ id: item.id, tabla });
    await marcarItem(item, "enviado", undefined, resultado.id);
  }

  await supabaseAdmin
    .from("tandas_envio")
    .update({ estado: "completado", completado_en: new Date().toISOString(), enviados: enviados.length, fallidos: fallidos.length })
    .eq("id", tanda.id);

  return { tandaId: tanda.id, enviados, fallidos };
}
