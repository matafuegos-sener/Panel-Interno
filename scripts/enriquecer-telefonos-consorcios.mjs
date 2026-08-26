// Buscar teléfono en Google Places para administradores de consorcios
// (leads_base, fuente gcba-oficial-ley941) que llegaron sin teléfono porque
// el registro oficial no lo tiene -- solo nombre y matrícula, nunca
// dirección.
//
// Piloto 2026-08-24 (100 nombres, mezcla persona física / empresa) dio 4%
// de match global, pero desglosado: nombres que parecen empresa/estudio
// (SRL, S.A., "Administración X SRL") matchearon 60% (3/5), nombres de
// persona física sola matchearon ~1% (1/95) -- Google no tiene forma de
// desambiguar un nombre de persona común sin dirección. Por eso este script
// SOLO corre contra el subconjunto que parece empresa/estudio (ver
// REGEX_EMPRESA) -- correr esto contra las ~8.175 filas de persona física
// sería gastar consultas por casi nada.
//
// Por default solo reporta (dry run). Con --commit=true escribe el
// teléfono (y whatsapp derivado) en leads_base para los matches aceptados
// -- todas las filas que comparten el mismo nombre de administrador, no
// solo la primera (un administrador puede figurar en varios consorcios).
//
// La Places API key es la de este proyecto (Sener), NO la de Talaris -- viven
// en archivos .env distintos y acá se lee explícitamente la de Sener, sin
// fallback a process.env, para no pegarle nunca por accidente con la de otro
// cliente.
//
// Uso:
//   node --env-file=.env.local scripts/enriquecer-telefonos-consorcios.mjs                 (reporte, no escribe nada)
//   node --env-file=.env.local scripts/enriquecer-telefonos-consorcios.mjs --commit=true    (escribe los matches aceptados)

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SENER_ENV_PATH = join(__dirname, "..", "..", ".env");
const AUDIT_DIR = join(__dirname, "..", "..", "leads", "_auditoria");

function loadEnvFile(path) {
  if (!existsSync(path)) throw new Error(`No existe: ${path}`);
  const lines = readFileSync(path, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function maskKey(key) {
  if (key.length <= 12) return "***";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (const arg of args) {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const REGEX_EMPRESA = /S\.?A\.?$|S\.?R\.?L\.?$|ESTUDIO|ADMINISTRACION|ADMINISTRACIÓN|CONSORCIO|GESTION|GESTIÓN|CIA\.|COMPA|GROUP|ADM\.|INMOBILIARIA|PROPIEDADES/i;

const STOPWORDS = new Set(["DE", "DEL", "LA", "LOS", "LAS", "Y", "S", "H", "SH", "SRL", "SR", "SA", "C"]);

function tokenizar(texto) {
  const norm = (texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ");
  return norm.split(/\s+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function similitud(nombreBuscado, nombreResultado) {
  const tokensBuscado = tokenizar(nombreBuscado);
  const tokensResultado = new Set(tokenizar(nombreResultado));
  if (tokensBuscado.length === 0) return 0;
  const coincidencias = tokensBuscado.filter((t) => tokensResultado.has(t)).length;
  return coincidencias / tokensBuscado.length;
}

// Mismo criterio que tools/extractor-caba.mjs: un celular argentino en
// formato internacional lleva el 9 de marca móvil después del 54; un fijo
// no, y a un fijo no le llega WhatsApp.
function tieneWhatsapp(telefono) {
  if (!telefono) return "";
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("549")) return "SI";
  if (digitos.startsWith("54")) return "NO";
  return "VERIFICAR";
}

async function buscarEnPlaces(nombre, apiKey) {
  const query = `${nombre} administración de consorcios, Ciudad Autónoma de Buenos Aires, Argentina`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.googleMapsUri,places.businessStatus,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "es-AR" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.places ?? [];
}

async function traerTodasLasFilasSinTelefono(supabase) {
  const filas = [];
  let desde = 0;
  const TAM = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("leads_base")
      .select("id, nombre")
      .eq("rubro", "consorcio")
      .eq("fuente", "gcba-oficial-ley941")
      .is("telefono", null)
      .range(desde, desde + TAM - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < TAM) break;
    desde += TAM;
  }
  return filas;
}

function escapeCsv(value) {
  if (value == null) return "";
  const str = String(value);
  if (!str.includes(",") && !str.includes('"') && !str.includes("\n")) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

async function main() {
  const args = parseArgs();
  const commit = args.commit === "true";
  const UMBRAL_ACEPTACION = 0.5;

  console.log("=== Verificación de credenciales ===");
  const envSener = loadEnvFile(SENER_ENV_PATH);
  const apiKey = envSener.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error(`GOOGLE_PLACES_API_KEY no encontrada en ${SENER_ENV_PATH}`);
  console.log(`Google Places API key: ${maskKey(apiKey)}  (leída de ${SENER_ENV_PATH})`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Credenciales de Supabase incompletas (correr con --env-file=.env.local desde panel-interno/)");
  console.log(`Supabase: ${supabaseUrl}`);
  console.log(`Modo: ${commit ? "COMMIT (escribe en leads_base)" : "REPORTE (dry run, no escribe nada)"}`);

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  console.log("\n=== Filtrando nombres que parecen empresa/estudio ===");
  const todasLasFilas = await traerTodasLasFilasSinTelefono(supabase);
  const filasEmpresa = todasLasFilas.filter((f) => REGEX_EMPRESA.test(f.nombre || ""));
  console.log(`Total sin teléfono: ${todasLasFilas.length} | Parecen empresa/estudio: ${filasEmpresa.length}`);

  const porNombre = new Map();
  for (const fila of filasEmpresa) {
    const clave = fila.nombre.trim().toUpperCase();
    if (!porNombre.has(clave)) porNombre.set(clave, { nombre: fila.nombre, ids: [] });
    porNombre.get(clave).ids.push(fila.id);
  }
  const nombresUnicos = [...porNombre.values()];
  console.log(`Nombres únicos a consultar: ${nombresUnicos.length}`);

  console.log("\n=== Consultando Google Places ===");
  const resultados = [];
  let consultas = 0;
  let filasActualizadas = 0;
  for (const { nombre, ids } of nombresUnicos) {
    let places = [];
    try {
      places = await buscarEnPlaces(nombre, apiKey);
      consultas++;
    } catch (err) {
      console.error(`\nError buscando "${nombre}": ${err.message}`);
    }

    const top = places[0];
    const nombreResultado = top?.displayName?.text ?? "";
    const score = top ? similitud(nombre, nombreResultado) : 0;
    const telefono = top?.internationalPhoneNumber ?? "";
    const aceptado = score >= UMBRAL_ACEPTACION && Boolean(telefono);

    resultados.push({
      nombre_buscado: nombre,
      cantidad_filas: ids.length,
      resultado_nombre: nombreResultado,
      resultado_telefono: telefono,
      resultado_direccion: top?.formattedAddress ?? "",
      resultado_maps_url: top?.googleMapsUri ?? "",
      similitud_score: score.toFixed(2),
      match_aceptado: aceptado ? "SI" : "NO",
    });

    if (aceptado && commit) {
      const { error } = await supabase
        .from("leads_base")
        .update({ telefono, whatsapp: tieneWhatsapp(telefono) })
        .in("id", ids);
      if (error) {
        console.error(`\nError escribiendo "${nombre}": ${error.message}`);
      } else {
        filasActualizadas += ids.length;
      }
    }

    process.stdout.write(aceptado ? "✓" : "·");
    await sleep(250);
  }
  console.log("");

  mkdirSync(AUDIT_DIR, { recursive: true });
  const filename = `enriquecimiento-telefonos-consorcios-${formatDate(new Date())}.csv`;
  const filepath = join(AUDIT_DIR, filename);
  const headers = Object.keys(resultados[0]);
  const csv = [headers.join(","), ...resultados.map((r) => headers.map((h) => escapeCsv(r[h])).join(","))].join("\n");
  writeFileSync(filepath, csv, "utf-8");

  const aceptados = resultados.filter((r) => r.match_aceptado === "SI");

  console.log("\n=== RESUMEN ===");
  console.log(`Consultas a Places API: ${consultas}`);
  console.log(`Matches aceptados (similitud >= ${UMBRAL_ACEPTACION} + con teléfono): ${aceptados.length}/${resultados.length} (${(100 * aceptados.length / resultados.length).toFixed(1)}%)`);
  console.log(`CSV: leads/_auditoria/${filename}`);
  if (commit) {
    console.log(`Filas de leads_base actualizadas: ${filasActualizadas}`);
  } else {
    console.log("No se escribió nada en Supabase (dry run) -- correr de nuevo con --commit=true para escribir los matches aceptados.");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
