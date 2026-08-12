// Limpieza de emails inválidos en leads_base -- disparada por el 22% de
// rebote real del envío del 2026-08-11 (14/64, ver build-log). La mayoría
// del rebote vino de registro-oficial-administradores-caba (matrículas
// viejas, emails mal cargados en el registro oficial). Este script:
//   1. Trae todos los emails no nulos de leads_base.
//   2. Descarta por sintaxis inválida.
//   3. Descarta por dominio sin MX ni A/AAAA (el dominio no puede recibir mail).
//   4. Descarta los 14 que ya confirmamos rebotados en Resend (ground truth,
//      no depende de DNS).
//   5. Deja un CSV de auditoría con lo que se sacó (nunca se borra sin
//      registro) y pone email=null en leads_base para esas filas -- el
//      resto del sistema ya trata "sin email" como no elegible para tanda,
//      no hace falta ninguna columna nueva.
//
// Uso: node --env-file=.env.local scripts/limpiar-emails-leads-base.mjs

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dns from "dns/promises";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_DIR = join(__dirname, "..", "..", "leads", "_auditoria");
const CONCURRENCIA_DNS = 25;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const REBOTADOS_CONFIRMADOS = new Set([
  "aquila1@fullzero.com.ar",
  "administracion@gestionmbd.com",
  "dmc@danielcaputo.com.ar",
  "lionel.lederman@gmail.com",
  "rnadigisil@gmail.com",
  "pagosadm@hotmail.com",
  "sergiodavidovsky@yahoo.com",
  "mariaelestevez@yahoo.com",
  "info@dominmobiliaria.com.ar",
  "admi_borghi@com.ar",
  "info@estudiosyg.com.ar",
  "info@administracionestudio1.com",
  "info@delbarrio.com",
  "info@adminco.com",
]);

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function traerTodasLasFilas() {
  const filas = [];
  let desde = 0;
  const TAMANO_PAGINA = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("leads_base")
      .select("id, nombre, rubro, email")
      .not("email", "is", null)
      .range(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < TAMANO_PAGINA) break;
    desde += TAMANO_PAGINA;
  }
  return filas;
}

async function dominioTieneMail(dominio) {
  try {
    const mx = await dns.resolveMx(dominio);
    if (mx && mx.length > 0) return true;
  } catch {
    // sigue al fallback
  }
  try {
    await dns.resolve4(dominio);
    return true;
  } catch {
    /* nada */
  }
  try {
    await dns.resolve6(dominio);
    return true;
  } catch {
    return false;
  }
}

async function validarDominiosEnLotes(dominios) {
  const resultado = new Map();
  const lista = [...dominios];
  let cursor = 0;
  async function trabajador() {
    while (cursor < lista.length) {
      const idx = cursor++;
      const dominio = lista[idx];
      resultado.set(dominio, await dominioTieneMail(dominio));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA_DNS }, trabajador));
  return resultado;
}

async function main() {
  console.log("Trayendo filas de leads_base con email...");
  const filas = await traerTodasLasFilas();
  console.log(`Total: ${filas.length}`);

  const invalidasPorSintaxis = filas.filter((f) => !REGEX_EMAIL.test(f.email.trim()));
  const conSintaxisOk = filas.filter((f) => REGEX_EMAIL.test(f.email.trim()));

  const dominios = new Set(conSintaxisOk.map((f) => f.email.trim().split("@")[1].toLowerCase()));
  console.log(`Dominios únicos a chequear (MX/A): ${dominios.size}`);
  const dominioValido = await validarDominiosEnLotes(dominios);

  const invalidasPorDominio = conSintaxisOk.filter((f) => {
    const dom = f.email.trim().split("@")[1].toLowerCase();
    return !dominioValido.get(dom);
  });

  const rebotadasConfirmadas = filas.filter((f) => REBOTADOS_CONFIRMADOS.has(f.email.trim().toLowerCase()));

  const idsInvalidos = new Map();
  for (const f of [...invalidasPorSintaxis, ...invalidasPorDominio]) {
    idsInvalidos.set(f.id, { fila: f, motivo: invalidasPorSintaxis.includes(f) ? "sintaxis" : "dominio_sin_mx" });
  }
  for (const f of rebotadasConfirmadas) {
    idsInvalidos.set(f.id, { fila: f, motivo: "rebote_confirmado_resend" });
  }

  console.log(`Inválidos por sintaxis: ${invalidasPorSintaxis.length}`);
  console.log(`Inválidos por dominio sin MX/A: ${invalidasPorDominio.length}`);
  console.log(`Rebotados confirmados (Resend): ${rebotadasConfirmadas.length}`);
  console.log(`Total a limpiar (únicos): ${idsInvalidos.size}`);
  console.log(`Quedan válidos: ${filas.length - idsInvalidos.size}`);

  mkdirSync(AUDIT_DIR, { recursive: true });
  const hoy = new Date().toISOString().slice(0, 10);
  const auditoriaPath = join(AUDIT_DIR, `emails-invalidos-${hoy}.csv`);
  const filasCsv = ["id,nombre,rubro,email,motivo"];
  for (const { fila, motivo } of idsInvalidos.values()) {
    const nombre = (fila.nombre || "").replace(/"/g, '""');
    filasCsv.push(`${fila.id},"${nombre}",${fila.rubro || ""},${fila.email},${motivo}`);
  }
  writeFileSync(auditoriaPath, filasCsv.join("\n"), "utf8");
  console.log(`Auditoría guardada en ${auditoriaPath}`);

  const ids = [...idsInvalidos.keys()];
  const TAMANO_LOTE = 200;
  for (let i = 0; i < ids.length; i += TAMANO_LOTE) {
    const lote = ids.slice(i, i + TAMANO_LOTE);
    const { error } = await supabase.from("leads_base").update({ email: null }).in("id", lote);
    if (error) throw error;
    console.log(`Limpiados ${Math.min(i + TAMANO_LOTE, ids.length)}/${ids.length}`);
  }

  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
