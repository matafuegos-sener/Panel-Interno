"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CATEGORIA_LABEL, FILTRO_VACIO, FiltroContactosState } from "@/data/crmUnificado";
import { OpcionesFiltro } from "@/lib/useContactosUnificados";
import { btnPrimaryClass, btnSecondaryClass } from "@/components/formStyles";

export { FILTRO_VACIO } from "@/data/crmUnificado";
export type { FiltroContactosState } from "@/data/crmUnificado";

const selectClass =
  "px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-brand-gray)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)] focus:border-transparent";

interface Props {
  opciones: OpcionesFiltro;
  value: FiltroContactosState;
  onChange: (value: FiltroContactosState) => void;
  onFiltrar: () => void;
  mostrarBusqueda?: boolean;
  mostrarCategoria?: boolean;
}

// Bloque de filtros compartido por CRM, Envío de mails y WhatsApp. El filtro
// que importa de verdad es Categoría (frío / contactado por mail /
// contactado por WhatsApp / ...) -- se mueve sola a medida que se toca al
// contacto (ver POST interacciones, PATCH estado). Provincia queda fija en
// CABA: hoy toda la base es de CABA, no hay dato de provincia distinto que
// filtrar. El día que se sume operación en GBA, ahí sí pasa a ser un select
// real. Las opciones de cada <select> llegan ya armadas del servidor
// (/api/admin/crm/opciones) -- este componente no baja filas para calcularlas.
export default function FiltrosContactos({ opciones, value, onChange, onFiltrar, mostrarBusqueda = false, mostrarCategoria = true }: Props) {
  const { categorias, rubros, tiers } = opciones;

  return (
    <div className="flex flex-col gap-2">
      {/* Renglón 1: nombre primero, filtros de siempre, "Filtrar" al final. */}
      <div className="flex flex-wrap items-center gap-2">
        {mostrarBusqueda && (
          <input
            className={`${selectClass} flex-1 min-w-[160px]`}
            type="search"
            placeholder="Buscar empresa…"
            value={value.busqueda}
            onChange={(e) => onChange({ ...value, busqueda: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && onFiltrar()}
          />
        )}

        {mostrarCategoria && (
          <select className={selectClass} value={value.categoria} onChange={(e) => onChange({ ...value, categoria: e.target.value })}>
            <option value="">Categoría — todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABEL[c] ?? c}</option>
            ))}
          </select>
        )}

        <RubroMultiSelect opciones={rubros} seleccionados={value.rubros} onChange={(rubros) => onChange({ ...value, rubros })} />

        <select className={selectClass} value={value.tier} onChange={(e) => onChange({ ...value, tier: e.target.value })}>
          <option value="">Tier — todos</option>
          {tiers.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select className={selectClass} value="CABA" disabled title="Toda la base actual es CABA">
          <option value="CABA">Provincia — CABA</option>
        </select>

        <select className={selectClass} value={value.activo} onChange={(e) => onChange({ ...value, activo: e.target.value as FiltroContactosState["activo"] })}>
          <option value="">Todos</option>
          <option value="si">Solo activos</option>
          <option value="no">Solo inactivos</option>
        </select>

        <button type="button" onClick={onFiltrar} className={`${btnPrimaryClass} ml-auto shrink-0`}>
          Filtrar
        </button>
      </div>

      {/* Renglón 2: los 3 filtros de envío, "Borrar filtro" debajo de "Filtrar". */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectClass} value={value.mailEnviado} onChange={(e) => onChange({ ...value, mailEnviado: e.target.value as FiltroContactosState["mailEnviado"] })}>
          <option value="">Mail — todos</option>
          <option value="si">Mail enviado</option>
          <option value="no">Mail no enviado</option>
        </select>

        <select className={selectClass} value={value.whatsappEnviado} onChange={(e) => onChange({ ...value, whatsappEnviado: e.target.value as FiltroContactosState["whatsappEnviado"] })}>
          <option value="">WhatsApp — todos</option>
          <option value="si">WhatsApp enviado</option>
          <option value="no">WhatsApp no enviado</option>
        </select>

        <select
          className={selectClass}
          value={value.llamadaRealizada}
          onChange={(e) => onChange({ ...value, llamadaRealizada: e.target.value as FiltroContactosState["llamadaRealizada"] })}
          title="Todavía no hay ninguna pantalla que marque una llamada como realizada"
        >
          <option value="">Llamada — todas</option>
          <option value="si">Llamada realizada</option>
          <option value="no">Llamada no realizada</option>
        </select>

        <button type="button" onClick={() => onChange(FILTRO_VACIO)} className={`${btnSecondaryClass} ml-auto shrink-0`}>
          Borrar filtro
        </button>
      </div>
    </div>
  );
}

function RubroMultiSelect({
  opciones,
  seleccionados,
  onChange,
}: {
  opciones: string[];
  seleccionados: string[];
  onChange: (rubros: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  function toggle(rubro: string) {
    onChange(seleccionados.includes(rubro) ? seleccionados.filter((r) => r !== rubro) : [...seleccionados, rubro]);
  }

  const etiqueta =
    seleccionados.length === 0
      ? "Rubro — todos"
      : seleccionados.length === 1
      ? seleccionados[0]
      : `${seleccionados.length} rubros`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={`${selectClass} flex items-center gap-1.5 min-w-[140px] justify-between`}
      >
        <span className="truncate max-w-[180px]">{etiqueta}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" />
      </button>

      {abierto && (
        <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-[var(--color-border)] rounded-lg shadow-xl p-2">
          {opciones.length === 0 && <p className="text-xs text-[var(--color-text-muted)] px-2 py-1.5">Sin rubros cargados.</p>}
          {seleccionados.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="w-full text-left px-2 py-1.5 text-xs text-[var(--color-brand-red)] hover:underline">
              Limpiar selección
            </button>
          )}
          {opciones.map((rubro) => (
            <label key={rubro} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-surface-subtle)] cursor-pointer text-sm">
              <input type="checkbox" checked={seleccionados.includes(rubro)} onChange={() => toggle(rubro)} className="accent-[var(--color-brand-red)]" />
              <span className="truncate">{rubro}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
