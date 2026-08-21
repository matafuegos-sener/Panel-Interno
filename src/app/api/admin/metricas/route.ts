import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { batchRunReports, runRealtimeReport, ReportResult } from "@/lib/ga4";
import { MetricasPayload } from "@/data/metricas";

const RANGOS_VALIDOS = [7, 28, 90];
const EVENTOS_CONVERSION = ["whatsapp_click", "presupuesto_enviado"];

// dimIndex negativo == "quiero un metricValue, no un dimensionValue" (evita
// tener dos helpers separados para leer una fila de GA).
function valor(row: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] } | undefined, dimIndex: number, metIndex: number): string {
  if (!row) return "";
  return dimIndex < 0 ? (row.metricValues?.[metIndex]?.value ?? "0") : (row.dimensionValues?.[dimIndex]?.value ?? "");
}

function fechaDesdeGa(fechaGa: string): string {
  // GA4 devuelve YYYYMMDD sin separadores.
  return `${fechaGa.slice(0, 4)}-${fechaGa.slice(4, 6)}-${fechaGa.slice(6, 8)}`;
}

// El cliente de GA (googleAuth + ga4) se instancia recién acá adentro del
// handler, nunca en top-level de módulo -- top-level se evalúa en build time
// ("Collecting page data") y con env vars sensitive rompe el build, ver
// build-log.md 2026-08-03 ("vercel-env-sensitive-bloquea-build").
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const diasParam = Number(searchParams.get("dias"));
  const dias = RANGOS_VALIDOS.includes(diasParam) ? diasParam : 28;

  if (!process.env.GA_PROPERTY_ID || !process.env.GA_SA_EMAIL || !process.env.GA_SA_PRIVATE_KEY) {
    return NextResponse.json({ error: "Métricas sin configurar — falta GA_PROPERTY_ID/GA_SA_EMAIL/GA_SA_PRIVATE_KEY en .env.local" }, { status: 503 });
  }

  const dateRanges = [{ startDate: `${dias}daysAgo`, endDate: "today" }];

  let reportsA: ReportResult[] | null;
  let reportsB: ReportResult[] | null;
  let realtime: { rows: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[] } | null;
  try {
    // batchRunReports acepta máximo 5 requests por llamada -- con 6 reports
    // hacen falta dos batches en paralelo, no uno solo.
    [reportsA, reportsB, realtime] = await Promise.all([
      batchRunReports([
        {
          dateRanges,
          dimensions: [{ name: "date" }],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "averageSessionDuration" }, { name: "engagementRate" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        },
        {
          dateRanges,
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 10,
        },
        {
          dateRanges,
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        },
        {
          dateRanges,
          dimensions: [{ name: "city" }],
          metrics: [{ name: "activeUsers" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: 10,
        },
        {
          dateRanges,
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        },
      ]),
      batchRunReports([
        {
          dateRanges,
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            filter: { fieldName: "eventName", inListFilter: { values: EVENTOS_CONVERSION } },
          },
        },
      ]),
      runRealtimeReport({ metrics: [{ name: "activeUsers" }] }),
    ]);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error consultando Google Analytics" }, { status: 502 });
  }

  if (!reportsA || !reportsB || !realtime) {
    return NextResponse.json({ error: "Métricas sin configurar" }, { status: 503 });
  }

  const [porDia, porPagina, porCanal, porCiudad, porDispositivo] = reportsA;
  const [porEvento] = reportsB;

  const serieDiaria = porDia.rows.map((r) => ({ fecha: fechaDesdeGa(valor(r, 0, 0)), usuarios: Number(valor(r, -1, 0)) }));
  const totalesDia = porDia.totals[0];

  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setDate(desde.getDate() - dias);

  const payload: MetricasPayload = {
    rango: { dias, desde: desde.toISOString().slice(0, 10), hasta: hoy.toISOString().slice(0, 10) },
    enVivo: { usuariosActivos: Number(realtime.rows[0]?.metricValues?.[0]?.value ?? 0) },
    kpis: {
      usuarios: Number(valor(totalesDia, -1, 0)),
      sesiones: Number(valor(totalesDia, -1, 1)),
      vistas: Number(valor(totalesDia, -1, 2)),
      duracionMediaSeg: Number(valor(totalesDia, -1, 3)),
      tasaInteraccionPct: Number(valor(totalesDia, -1, 4)) * 100,
    },
    serieDiaria,
    topPaginas: porPagina.rows.map((r) => ({ pagina: valor(r, 0, 0), vistas: Number(valor(r, -1, 0)) })),
    canales: porCanal.rows.map((r) => ({ canal: valor(r, 0, 0), sesiones: Number(valor(r, -1, 0)) })),
    ciudades: porCiudad.rows.map((r) => ({ ciudad: valor(r, 0, 0), usuarios: Number(valor(r, -1, 0)) })),
    dispositivos: porDispositivo.rows.map((r) => ({ dispositivo: valor(r, 0, 0), sesiones: Number(valor(r, -1, 0)) })),
    conversiones: EVENTOS_CONVERSION.map((evento) => ({
      evento,
      cantidad: Number(porEvento.rows.find((r) => valor(r, 0, 0) === evento)?.metricValues?.[0]?.value ?? 0),
    })),
  };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
