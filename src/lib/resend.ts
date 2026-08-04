import "server-only";

// contacto@matafuegossener.com.ar ya está verificado en Resend para envío
// (ver pendientes.md, punto 2). Se puede pisar con MAIL_FROM en .env.local
// si el día de mañana se manda desde otra casilla del dominio.
export const MAIL_FROM = process.env.MAIL_FROM || "Matafuegos Sener <contacto@matafuegossener.com.ar>";

interface EnviarMailInput {
  to: string;
  subject: string;
  text: string;
}

interface EnviarMailResultado {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function enviarMail({ to, subject, text }: EnviarMailInput): Promise<EnviarMailResultado> {
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
    body: JSON.stringify({ from: MAIL_FROM, to, subject, text }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: data?.message || `Resend respondió ${res.status}` };
  }
  return { ok: true, id: data?.id };
}
