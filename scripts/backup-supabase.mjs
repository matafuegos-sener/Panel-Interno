// Backup local de la base de Supabase (plan free, sin backup automático --
// ver pendientes.md punto 14). Baja las 10 tablas completas vía REST con la
// service role key y las guarda en un JSON con timestamp, fuera del repo.
// Uso: node --env-file=.env.local scripts/backup-supabase.mjs
// Programado a diario vía Task Scheduler de Windows (ver docs/PROJECT_MAP.md).
import fs from "fs";
import path from "path";

const BACKUP_DIR = process.env.BACKUP_DIR || "C:\\Users\\yosoy\\Backups\\panel-interno-sener";
const RETENCION_BACKUPS = 30;

// Si se agrega una tabla nueva (migración `create table ...`), sumarla acá
// a mano -- a propósito no se lista dinámicamente desde information_schema,
// para no arrastrar sin querer una tabla que no importa respaldar.
const TABLAS = [
  "bases",
  "contactos",
  "leads_base",
  "interacciones",
  "acciones",
  "mensajes_predefinidos",
  "agenda_eventos",
  "tandas_envio",
  "tandas_envio_items",
  "campanas_mail",
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY -- correr con --env-file=.env.local");
  process.exit(1);
}

async function traerTodo(tabla) {
  const filas = [];
  const pagina = 1000;
  for (let desde = 0; ; desde += pagina) {
    const res = await fetch(`${url}/rest/v1/${tabla}?select=*&offset=${desde}&limit=${pagina}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`${tabla}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    filas.push(...data);
    if (data.length < pagina) break;
  }
  return filas;
}

// Se queda solo con los últimos RETENCION_BACKUPS archivos -- si no, el
// backup diario crece sin límite para siempre.
function podarBackupsViejos() {
  const archivos = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
    .sort();
  const sobran = archivos.length - RETENCION_BACKUPS;
  if (sobran <= 0) return;
  for (const viejo of archivos.slice(0, sobran)) {
    fs.unlinkSync(path.join(BACKUP_DIR, viejo));
    console.log(`Borrado backup viejo: ${viejo}`);
  }
}

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const resultado = {};
  for (const tabla of TABLAS) {
    resultado[tabla] = await traerTodo(tabla);
    console.log(`${tabla}: ${resultado[tabla].length} filas`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivo = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
  fs.writeFileSync(archivo, JSON.stringify(resultado, null, 2));
  console.log(`Backup guardado en ${archivo}`);

  podarBackupsViejos();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
