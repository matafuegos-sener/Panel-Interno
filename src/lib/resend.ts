import "server-only";

// contacto@matafuegossener.com.ar ya está verificado en Resend para envío
// (ver pendientes.md, punto 2). Se usa para el mail de prueba y para
// verificar el dominio -- no para las tandas masivas (ver MAIL_FROM_PROSPECCION).
export const MAIL_FROM = process.env.MAIL_FROM || "Matafuegos Sener <contacto@matafuegossener.com.ar>";

// Remitente de las tandas de prospección en frío, separado a propósito de
// `contacto@` (esa casilla recibe respuestas reales de clientes vía
// ImprovMX -- si el envío masivo la quema, se arriesga también la entrega
// del correo real del negocio). Ver build-log 2026-08-12. Sin verificar
// todavía el subdominio, cae a MAIL_FROM para no romper el envío.
export const MAIL_FROM_PROSPECCION =
  process.env.MAIL_FROM_PROSPECCION || MAIL_FROM;

interface EnviarMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

interface EnviarMailResultado {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function enviarMail({ to, subject, text, html, from }: EnviarMailInput): Promise<EnviarMailResultado> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Falta RESEND_API_KEY en .env.local" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: from || MAIL_FROM, to, subject, text, ...(html ? { html } : {}) }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: data?.message || `Resend respondió ${res.status}` };
  }
  return { ok: true, id: data?.id };
}
