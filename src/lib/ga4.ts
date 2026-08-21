import "server-only";
import { getGoogleAccessToken } from "@/lib/googleAuth";

// Transporte fino contra la Analytics Data API (REST, v1beta) -- sin el
// cliente oficial `@google-analytics/data` (arrastra gRPC, pesado y frágil
// en serverless, ver plan). Nada de formato ni de negocio acá, eso vive en
// data/metricas.ts y en el route handler que arma cada report.

const BASE_URL = "https://analyticsdata.googleapis.com/v1beta";

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ReportRequest {
  dateRanges: DateRange[];
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  dimensionFilter?: unknown;
  orderBys?: unknown[];
  limit?: number;
}

export interface ReportRow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}

export interface ReportResult {
  rows: ReportRow[];
  totals: ReportRow[];
}

export interface RealtimeResult {
  rows: ReportRow[];
}

// Config ausente (propiedad sin configurar) -> null, nunca tira. Cualquier
// otro fallo (token vencido, propiedad sin acceso, cuota) sí tira -- el
// route handler lo traduce a 502 con el mensaje real.
export async function batchRunReports(requests: ReportRequest[]): Promise<ReportResult[] | null> {
  const propertyId = process.env.GA_PROPERTY_ID;
  const token = await getGoogleAccessToken();
  if (!propertyId || !token) return null;

  const res = await fetch(`${BASE_URL}/properties/${propertyId}:batchRunReports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Google Analytics Data API (${res.status}): ${detalle}`);
  }
  const data = (await res.json()) as { reports: { rows?: ReportRow[]; totals?: ReportRow[] }[] };
  return data.reports.map((r) => ({ rows: r.rows ?? [], totals: r.totals ?? [] }));
}

export async function runRealtimeReport(request: {
  dimensions?: { name: string }[];
  metrics: { name: string }[];
}): Promise<RealtimeResult | null> {
  const propertyId = process.env.GA_PROPERTY_ID;
  const token = await getGoogleAccessToken();
  if (!propertyId || !token) return null;

  const res = await fetch(`${BASE_URL}/properties/${propertyId}:runRealtimeReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Google Analytics Data API realtime (${res.status}): ${detalle}`);
  }
  const data = (await res.json()) as { rows?: ReportRow[] };
  return { rows: data.rows ?? [] };
}
