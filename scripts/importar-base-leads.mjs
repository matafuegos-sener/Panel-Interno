// Importa la base de leads trackeada el 2026-08-03 (../../leads/**/*.csv,
// ver docs/informe-base-de-leads-2026-08-03.md) a la tabla leads_base de
// Supabase. Vacía la tabla antes de insertar para que sea idempotente --
// correr de nuevo si se vuelve a trackear la base.
//
// Requiere que la migración supabase/migrations/0003_leads_base.sql ya haya
// sido aplicada (SQL Editor del dashboard de Supabase).
//
// Uso: node --env-file=.env.local scripts/importar-base-leads.mjs

import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEADS_DIR = join(__dirname, "..", "..", "leads");
const TAMANO_LOTE = 500;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Mapea el header de cada CSV de origen (tres esquemas distintos -- Google
// Maps, registro oficial GCBA, semilla manual) a la columna de leads_base.
const HEADER_A_COLUMNA = {
  nombre: "nombre",
  rubro: "rubro",
  ciudad: "ciudad",
  direccion: "direccion",
  telefono: "telefono",
  whatsapp: "whatsapp",
  website: "website",
  redSocial: "red_social",
  rating: "rating",
  reviews: "reviews",
  priceLevel: "price_level",
  businessStatus: "business_status",
  maps_url: "maps_url",
  matricula: "matricula",
  fecha_inscripcion: "fecha_inscripcion",
  oneroso: "oneroso",
  sanciones: "sanciones",
  tier: "tier",
  email: "email",
  fuente: "fuente",
  notas: "notas",
};

function parseCsv(contenido) {
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;

  for (let i = 0; i < contenido.length; i++) {
    const c = contenido[i];
    if (entreComillas) {
      if (c === '"' && contenido[i + 1] === '"') {
        campo += '"';
        i++;
        continue;
      }
      if (c === '"') {
        entreComillas = false;
        continue;
      }
      campo += c;
      continue;
    }
    if (c === '"') {
      entreComillas = true;
      continue;
    }
    if (c === ",") {
      fila.push(campo);
      campo = "";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
      continue;
    }
    campo += c;
  }
  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.length > 1 || f[0] !== "");
}

function listarCsvs(dir) {
  const resultado = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      resultado.push(...listarCsvs(ruta));
      continue;
    }
    if (entrada.endsWith(".csv")) resultado.push(ruta);
  }
  return resultado;
}

function filaARegistro(headers, valores) {
  const registro = {};
  headers.forEach((h, i) => {
    const columna = HEADER_A_COLUMNA[h];
    if (!columna) return;
    const valor = (valores[i] ?? "").trim();
    if (valor === "") return;

    if (columna === "rating") {
      const num = Number(valor);
      if (!Number.isNaN(num)) registro.rating = num;
      return;
    }
    if (columna === "reviews") {
      const num = parseInt(valor, 10);
      if (!Number.isNaN(num)) registro.reviews = num;
      return;
    }
    registro[columna] = valor;
  });
  return registro;
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY -- correr con --env-file=.env.local");
  }

  const archivos = listarCsvs(LEADS_DIR);
  console.log(`${archivos.length} archivos CSV encontrados en ${LEADS_DIR}`);

  const registros = [];
  for (const archivo of archivos) {
    const filas = parseCsv(readFileSync(archivo, "utf-8"));
    const [headers, ...resto] = filas;
    for (const valores of resto) {
      registros.push(filaARegistro(headers, valores));
    }
    console.log(`  ${archivo.replace(LEADS_DIR, "leads")}: ${resto.length} filas`);
  }

  console.log(`Total a importar: ${registros.length}`);

  const { error: errorDelete } = await supabase
    .from("leads_base")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (errorDelete) throw new Error(`Error vaciando tabla: ${errorDelete.message}`);

  let insertados = 0;
  for (let i = 0; i < registros.length; i += TAMANO_LOTE) {
    const lote = registros.slice(i, i + TAMANO_LOTE);
    const { error } = await supabase.from("leads_base").insert(lote);
    if (error) throw new Error(`Error insertando lote ${i}-${i + lote.length}: ${error.message}`);
    insertados += lote.length;
    console.log(`Insertados ${insertados}/${registros.length}`);
  }

  console.log("Importación completa.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
