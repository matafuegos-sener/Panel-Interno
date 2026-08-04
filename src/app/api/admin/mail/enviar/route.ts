import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarMail } from "@/lib/resend";
import { TablaOrigen } from "@/data/crm";

interface ItemTanda {
  id: string;
  tabla: TablaOrigen;
}

const COLUMNA_MAIL: Record<TablaOrigen, string> = { contactos: "mail_1", leads_base: "email" };
const MAX_TANDA = 25;

// Envía uno por uno (nunca CC/BCC, ver reglas de email del CLAUDE.md
// global) y marca mail_enviado=true en la tabla de origen de cada contacto
// para que no se repita en la próxima tanda.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const items: ItemTanda[] = Array.isArray(body?.items) ? body.items : [];
  if (
    !body ||
    typeof body.asunto !== "string" ||
    !body.asunto.trim() ||
    typeof body.cuerpo !== "string" ||
    !body.cuerpo.trim() ||
    items.length === 0
  ) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  if (items.length > MAX_TANDA) {
    return NextResponse.json({ error: `La tanda no puede superar ${MAX_TANDA} contactos` }, { status: 400 });
  }

  const enviados: ItemTanda[] = [];
  const fallidos: { id: string; tabla: TablaOrigen; motivo: string }[] = [];

  for (const item of items) {
    const tabla = item.tabla === "contactos" || item.tabla === "leads_base" ? item.tabla : null;
    if (!tabla) {
      fallidos.push({ id: item.id, tabla: item.tabla, motivo: "Tabla inválida" });
      continue;
    }

    const { data: fila, error: errFila } = await supabaseAdmin
      .from(tabla)
      .select(`id, mail_enviado, ${COLUMNA_MAIL[tabla]}`)
      .eq("id", item.id)
      .single();

    if (errFila || !fila) {
      fallidos.push({ id: item.id, tabla, motivo: "No se encontró el contacto" });
      continue;
    }
    const email = (fila as unknown as Record<string, string | null>)[COLUMNA_MAIL[tabla]];
    if (!email) {
      fallidos.push({ id: item.id, tabla, motivo: "Sin email" });
      continue;
    }
    if ((fila as unknown as Record<string, boolean>).mail_enviado) {
      fallidos.push({ id: item.id, tabla, motivo: "Ya se le había enviado" });
      continue;
    }

    const resultado = await enviarMail({ to: email, subject: body.asunto.trim(), text: body.cuerpo });
    if (!resultado.ok) {
      fallidos.push({ id: item.id, tabla, motivo: resultado.error || "Resend rechazó el envío" });
      continue;
    }

    await supabaseAdmin
      .from(tabla)
      .update({ mail_enviado: true, mail_enviado_en: new Date().toISOString(), categoria: "contactado_mail" })
      .eq("id", item.id);
    enviados.push({ id: item.id, tabla });
  }

  return NextResponse.json({ enviados: enviados.length, fallidos });
}
