"use client";

import { useEffect, useState } from "react";
import { MetricasPayload, CANAL_LABEL, DISPOSITIVO_LABEL, EVENTO_LABEL } from "@/data/metricas";
import { panelCardClass, btnSecondaryClass } from "@/components/formStyles";

const RANGOS = [
  { dias: 7, label: "7 días" },
  { dias: 28, label: "28 días" },
  { dias: 90, label: "90 días" },
] as const;

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR");
}

function fmtDuracion(seg: number): string {
  const min = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${min}m ${s}s`;
}

function fmtFechaCorta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function fmtPagina(path: string): string {
  return path === "/" ? "Inicio" : path;
}

export default function MetricasView() {
  const [dias, setDias] = useState<7 | 28 | 90>(28);
  const [data, setData] = useState<MetricasPayload | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinConfigurar, setSinConfigurar] = useState(false);

  async function cargar() {
    setCargando(true);
    setError(null);
    setSinConfigurar(false);
    try {
      const res = await fetch(`/api/admin/metricas?dias=${dias}`);
      const body = await res.json();
      if (res.status === 503) {
        setSinConfigurar(true);
        return;
      }
      if (!res.ok) {
        setError(body?.error ?? `Error ${res.status}`);
        return;
      }
      setData(body as MetricasPayload);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">Métricas</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Quién entra al sitio, desde dónde y qué hace</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGOS.map((r) => (
            <button
              key={r.dias}
              type="button"
              onClick={() => setDias(r.dias)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                dias === r.dias
                  ? "bg-[var(--color-brand-red)] text-white"
                  : "bg-[var(--color-surface-subtle)] text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]"
              }`}
            >
              {r.label}
            </button>
          ))}
          <button type="button" onClick={cargar} disabled={cargando} className={btnSecondaryClass}>
            {cargando ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {cargando && !data && (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">Cargando métricas…</p>
      )}

      {!cargando && sinConfigurar && (
        <div className="border border-dashed border-[var(--color-border)] rounded-2xl py-12 px-6 text-center">
          <p className="text-sm text-[var(--color-brand-dark)] font-semibold mb-1">Métricas sin configurar</p>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
            Falta crear la propiedad de Google Analytics y la cuenta de servicio, y cargar sus datos en <code>.env.local</code>. Ver el plan en{" "}
            <code>docs/superpowers/plans/</code>.
          </p>
        </div>
      )}

      {!cargando && !sinConfigurar && error && (
        <div className="border border-red-200 bg-red-50 rounded-2xl py-8 px-6 text-center">
          <p className="text-sm text-red-700 font-semibold mb-1">No se pudo cargar</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!sinConfigurar && !error && data && (
        <div className="flex flex-col gap-6">
          <div className={`${panelCardClass} p-4 flex items-center gap-3`}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <p className="text-sm text-[var(--color-brand-dark)]">
              <strong>{fmtNum(data.enVivo.usuariosActivos)}</strong> persona{data.enVivo.usuariosActivos === 1 ? "" : "s"} navegando el sitio ahora mismo
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Kpi label="Usuarios" valor={fmtNum(data.kpis.usuarios)} />
            <Kpi label="Sesiones" valor={fmtNum(data.kpis.sesiones)} />
            <Kpi label="Vistas" valor={fmtNum(data.kpis.vistas)} />
            <Kpi label="Duración media" valor={fmtDuracion(data.kpis.duracionMediaSeg)} />
            <Kpi label="Interacción" valor={`${data.kpis.tasaInteraccionPct.toFixed(0)}%`} />
          </div>

          <div className={`${panelCardClass} p-4 sm:p-6`}>
            <h3 className="type-label text-[var(--color-text-muted)] mb-4">Usuarios por día</h3>
            {data.serieDiaria.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Sin datos en este rango todavía.</p>
            ) : (
              <SerieDiaria serie={data.serieDiaria} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Ranking
              titulo="Páginas más vistas"
              filas={data.topPaginas.map((p) => ({ etiqueta: fmtPagina(p.pagina), valor: p.vistas }))}
              vacio="Sin vistas registradas en este rango."
            />
            <Ranking
              titulo="Cómo llegaron"
              filas={data.canales.map((c) => ({ etiqueta: CANAL_LABEL[c.canal] ?? c.canal, valor: c.sesiones }))}
              vacio="Sin sesiones registradas en este rango."
            />
            <Ranking
              titulo="De dónde son"
              filas={data.ciudades.map((c) => ({ etiqueta: c.ciudad || "Sin dato", valor: c.usuarios }))}
              vacio="Sin datos de ciudad en este rango."
            />
            <Ranking
              titulo="Dispositivo"
              filas={data.dispositivos.map((d) => ({ etiqueta: DISPOSITIVO_LABEL[d.dispositivo] ?? d.dispositivo, valor: d.sesiones }))}
              vacio="Sin sesiones registradas en este rango."
            />
          </div>

          <div className={`${panelCardClass} p-4 sm:p-6`}>
            <h3 className="type-label text-[var(--color-text-muted)] mb-4">Conversiones</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.conversiones.map((c) => (
                <div key={c.evento} className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-surface-subtle)]">
                  <span className="text-sm text-[var(--color-brand-dark)]">{EVENTO_LABEL[c.evento] ?? c.evento}</span>
                  <span className="text-lg font-bold text-[var(--color-brand-red)]">{fmtNum(c.cantidad)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className={`${panelCardClass} p-4`}>
      <p className="type-label text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[var(--color-brand-dark)]">{valor}</p>
    </div>
  );
}

function SerieDiaria({ serie }: { serie: { fecha: string; usuarios: number }[] }) {
  const max = Math.max(1, ...serie.map((d) => d.usuarios));
  return (
    <div className="flex items-end gap-1 h-32">
      {serie.map((d) => (
        <div key={d.fecha} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 group" title={`${d.fecha}: ${d.usuarios}`}>
          <div
            className="w-full rounded-t bg-[var(--color-brand-red)] group-hover:bg-[var(--color-brand-red-dark)] transition-colors min-h-[2px]"
            style={{ height: `${(d.usuarios / max) * 100}%` }}
          />
          {serie.length <= 31 && (
            <span className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">{fmtFechaCorta(d.fecha)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Ranking({ titulo, filas, vacio }: { titulo: string; filas: { etiqueta: string; valor: number }[]; vacio: string }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <div className={`${panelCardClass} p-4 sm:p-6`}>
      <h3 className="type-label text-[var(--color-text-muted)] mb-4">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-6">{vacio}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filas.map((f) => (
            <div key={f.etiqueta} className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-brand-dark)] w-32 sm:w-40 shrink-0 truncate" title={f.etiqueta}>
                {f.etiqueta}
              </span>
              <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-subtle)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-brand-red)]" style={{ width: `${(f.valor / max) * 100}%` }} />
              </div>
              <span className="text-sm text-[var(--color-text-muted)] w-12 text-right shrink-0">{fmtNum(f.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
