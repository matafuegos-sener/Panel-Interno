import "server-only";
import { createSign } from "node:crypto";

// Auth server-to-server contra Google con cuenta de servicio (JWT RS256 →
// canjeado por access token, scope de solo lectura de Analytics). Se firma
// a mano con node:crypto en vez de traer el SDK oficial `google-auth-library`
// -- es un solo endpoint (oauth2.googleapis.com/token), no vale la pena la
// dependencia. El token se cachea en memoria del módulo hasta 5 min antes de
// vencer (dura 1h) para no re-firmar en cada request.

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MARGEN_VENCIMIENTO_MS = 5 * 60 * 1000;

let tokenCacheado: { token: string; expiraEn: number } | null = null;

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function firmarJwt(email: string, privateKey: string): string {
  const ahora = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: ahora,
    exp: ahora + 3600,
  };
  const encabezado = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(claims)))}`;
  const firma = createSign("RSA-SHA256").update(encabezado).sign(privateKey);
  return `${encabezado}.${base64url(firma)}`;
}

// Falta cualquiera de las dos env vars -> null, nunca tira. El caller decide
// el 503 "sin configurar" (mismo criterio que el resto de las integraciones
// de este proyecto, ver mail/verificar/route.ts).
export async function getGoogleAccessToken(): Promise<string | null> {
  const email = process.env.GA_SA_EMAIL;
  const privateKeyRaw = process.env.GA_SA_PRIVATE_KEY;
  if (!email || !privateKeyRaw) return null;

  if (tokenCacheado && tokenCacheado.expiraEn - MARGEN_VENCIMIENTO_MS > Date.now()) {
    return tokenCacheado.token;
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const jwt = firmarJwt(email, privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`No se pudo autenticar con Google (${res.status}): ${detalle}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCacheado = { token: data.access_token, expiraEn: Date.now() + data.expires_in * 1000 };
  return tokenCacheado.token;
}
