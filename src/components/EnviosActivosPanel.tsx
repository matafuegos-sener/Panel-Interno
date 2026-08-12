"use client";

import { useState } from "react";
import { DetalleTanda, ItemTandaEnvio, TandaEnvio } from "@/data/tandas";
import { useTandasEnvio } from "@/lib/useTandasEnvio";
import { panelCardClass } from "@/components/formStyles";
import { fmtFecha } from "@/lib/fechas";

const TIPO_LABEL: Record<TandaEnvio["tipo"], string> = { mail: "Mail", whatsapp: "WhatsApp" };

// Solo se usa cuando it.estado === "enviado" -- "fallido"/"pendiente" ya
// tienen su propio color más arriba y no dependen de Resend.
const RESEND_ESTADO_LABEL: Record<ItemTandaEnvio["resendEstado"], string> = {
  enviado: "Enviado",
  entregado: "Entregado",
  rebotado: "Rebotó",
  quejado: "Marcado spam",
};
const RESEND_ESTADO_COLOR: Record<ItemTandaEnvio["resendEstado"], string> = {
  enviado: "text-green-700",
  entregado: "text-green-700",
  rebotado: "text-red-700",
  quejado: "text-red-700",
};

// Antes solo mostraba la hora -- una tanda vieja sin terminar (ej. quedó
// "en_curso" varios días) se veía indistinguible de una de hoy. Ahora
// siempre lleva fecha + hora.
function fmtFechaHora(iso: string): string {
  const hora = new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fmtFecha(iso)} ${hora}`;
}

// Lista de tandas de mail/WhatsApp con progreso en vivo (poll cada 5s vía
// useTandasEnvio) y click-to-expand inline para ver el detalle item por item
// sin salir de la pantalla -- se usa tal cual dentro de la Agenda (con
// `limite`, y con `estado` para separar "en curso" de "finalizados") y en la
// vista dedicada "Envíos activos" (sin límite ni filtro de estado).
export default function EnviosActivosPanel({
  tipo,
  limite,
  estado,
}: {
  tipo?: TandaEnvio["tipo"];
  limite?: number;
  estado?: TandaEnvio["estado"];
}) {
  const tandas = useTandasEnvio();
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, DetalleTanda>>({});

  async function toggle(id: string) {
    const abriendo = expandidoId !== id;
    setExpandidoId(abriendo ? id : null);
    if (abriendo && !detalles[id]) {
      const res = await fetch(`/api/admin/envios/${id}`);
      const data = await res.json();
      if (data && !data.error) setDetalles((prev) => ({ ...prev, [id]: data }));
    }
  }

  if (tandas === null) {
    return <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>;
  }

  const filtrados = tandas.filter((t) => (tipo ? t.tipo === tipo : true) && (estado ? t.estado === estado : true));
  const ordenados = [...filtrados].sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === "en_curso" ? -1 : 1;
    return b.creadoEn.localeCompare(a.creadoEn);
  });
  const lista = limite ? ordenados.slice(0, limite) : ordenados;

  if (lista.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-4 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
        {estado === "completado" ? "Ningún envío finalizado todavía." : "Ningún envío activo."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {lista.map((t) => {
        const resueltos = t.enviados + t.fallidos;
        const pct = t.total > 0 ? Math.round((resueltos / t.total) * 100) : 0;
        const expandido = expandidoId === t.id;
        const detalle = detalles[t.id];
        return (
          <div key={t.id} className={panelCardClass}>
            <button type="button" onClick={() => toggle(t.id)} className="w-full text-left p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-sm font-medium text-[var(--color-brand-dark)]">{TIPO_LABEL[t.tipo]}</span>
                  {(t.asunto || t.plantillaTitulo) && (
                    <span className="text-xs text-[var(--color-text-muted)] truncate">{t.asunto || t.plantillaTitulo}</span>
                  )}
                  <span className="text-xs text-[var(--color-text-muted)]">{fmtFechaHora(t.creadoEn)}</span>
                </div>
                <div className="h-1.5 w-full max-w-[220px] bg-[var(--color-bg-warm)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--color-brand-red)] transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {t.conProblemas > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                    {t.conProblemas} {t.conProblemas === 1 ? "problema" : "problemas"}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    t.estado === "en_curso" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                  }`}
                >
                  {t.estado === "en_curso" ? `${resueltos}/${t.total}` : "Completado"}
                </span>
              </div>
            </button>
            {expandido && (
              <div className="border-t border-[var(--color-border-subtle)] p-3">
                {!detalle && <p className="text-xs text-[var(--color-text-muted)]">Cargando detalle…</p>}
                {detalle && (
                  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                    {detalle.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-2 text-xs py-1 border-b border-[var(--color-border-subtle)] last:border-0"
                      >
                        <span className="text-[var(--color-brand-dark)] truncate">{it.nombre}</span>
                        <span
                          className={`shrink-0 ${
                            it.estado === "enviado"
                              ? RESEND_ESTADO_COLOR[it.resendEstado]
                              : it.estado === "fallido"
                                ? "text-amber-700"
                                : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {it.estado === "pendiente"
                            ? "Pendiente"
                            : it.estado === "enviado"
                              ? RESEND_ESTADO_LABEL[it.resendEstado]
                              : it.motivo || "Fallido"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
