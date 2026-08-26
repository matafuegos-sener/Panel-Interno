import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Único lugar donde nos enteramos si un mail rebotó o fue marcado spam --
// antes no existía ningún dato de entrega, solo "Resend aceptó el POST"
// (ver build-log 2026-08-12). Resend firma cada request con svix; sin
// RESEND_WEBHOOK_SECRET no hay forma de distinguir un webhook real de
// cualquiera que le pegue a esta URL, así que sin el secret configurado
// se rechaza todo.
const EVENTO_A_ESTADO: Record<string, "entregado" | "rebotado" | "quejado"> = {
  "email.delivered": "entregado",
  "email.bounced": "rebotado",
  "email.complained": "quejado",
};

interface ResendWebhookPayload {
  type: string;
  data: { email_id?: string; bounce?: { type?: string } };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Falta RESEND_WEBHOOK_SECRET" }, { status: 500 });
  }

  const payload = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Faltan headers svix" }, { status: 400 });
  }

  let evento: ResendWebhookPayload;
  try {
    const wh = new Webhook(secret);
    evento = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const nuevoEstado = EVENTO_A_ESTADO[evento.type];
  const emailId = evento.data?.email_id;
  if (!nuevoEstado || !emailId) {
    return NextResponse.json({ ok: true, ignorado: evento.type });
  }

  // rebotado/quejado pisa entregado si llega después; entregado nunca pisa
  // rebotado/quejado si por algún motivo llegan fuera de orden.
  const { data: actual } = await supabaseAdmin
    .from("tandas_envio_items")
    .select("resend_estado, contacto_id, tabla_origen")
    .eq("resend_id", emailId)
    .maybeSingle();
  if (actual?.resend_estado === "rebotado" || actual?.resend_estado === "quejado") {
    return NextResponse.json({ ok: true });
  }

  await supabaseAdmin.from("tandas_envio_items").update({ resend_estado: nuevoEstado }).eq("resend_id", emailId);

  // Bloquea la casilla para que no se le vuelva a mandar -- cualquier
  // rebote (Permanent o Transient) o queja de spam. Antes el Transient no
  // bloqueaba (razonamiento: "puede resolverse solo"), pero decisión de
  // Baltasar 2026-08-24: prefiere no arriesgarse a repetir el mismo rebote
  // -- una casilla que rebotó una vez, aunque sea temporal, se trata como
  // vía muerta de acá en adelante. Ver build-log 2026-08-24.
  const debeBloquear = nuevoEstado === "quejado" || nuevoEstado === "rebotado";
  if (debeBloquear && actual?.contacto_id && actual?.tabla_origen) {
    await supabaseAdmin
      .from(actual.tabla_origen)
      .update({ mail_bloqueado: true, mail_bloqueado_en: new Date().toISOString() })
      .eq("id", actual.contacto_id);
  }

  return NextResponse.json({ ok: true });
}
