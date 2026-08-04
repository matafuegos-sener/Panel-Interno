"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CATEGORIA_LABEL, ContactoUnificado, uniqueSorted } from "@/data/crmUnificado";

export interface FiltroContactosState {
  categoria: string;
  rubros: string[];
  tier: string;
  activo: "" | "si" | "no";
  busqueda: string;
}

export const FILTRO_VACIO: FiltroContactosState = { categoria: "", rubros: [], tier: "", activo: "", busqueda: "" };

export function normalizarBusqueda(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function aplicaFiltro(row: ContactoUnificado, f: FiltroContactosState): boolean {
  if (f.categoria && row.categoria !== f.categoria) return false;
  if (f.rubros.length > 0 && !(row.rubro && f.rubros.includes(row.rubro))) return false;
  if (f.tier && row.tier !== f.tier) return false;
  if (f.activo === "si" && row.activo === false) return false;
  if (f.activo === "no" && row.activo !== false) return false;
  if (f.busqueda.trim()) {
    const q = normalizarBusqueda(f.busqueda.trim());
    if (!normalizarBusqueda(row.nombre).includes(q)) return false;
  }
  return true;
}

const selectClass =
  "px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-brand-gray)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)] focus:border-transparent";

interface Props {
  rows: ContactoUnificado[];
  value: FiltroContactosState;
  onChange: (value: FiltroContactosState) => void;
  onFiltrar: () => void;
  mostrarBusqueda?: boolean;
}

// Bloque de filtros compartido por CRM, Envío de mails y WhatsApp. El filtro
// que importa de verdad es Categoría (frío / contactado por mail /
// contactado por WhatsApp / ...) -- se mueve sola a medida que se toca al
// contacto (ver POST interacciones, PATCH estado). Provincia queda fija en
// CABA: hoy toda la base es de CABA, no hay dato de provincia distinto que
// filtrar. El día que se sume operación en GBA, ahí sí pasa a ser un select
// real.
export default function FiltrosContactos({ rows, value, onChange, onFiltrar, mostrarBusqueda = false }: Props) {
  const categorias = useMemo(() => uniqueSorted(rows, "categoria"), [rows]);
  const rubros = useMemo(() => uniqueSorted(rows, "rubro"), [rows]);
  const tiers = useMemo(() => uniqueSorted(rows, "tier"), [rows]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={selectClass} value={value.categoria} onChange={(e) => onChange({ ...value, categoria: e.target.value })}>
        <option value="">Categoría — todas</option>
        {categorias.map((c) => (
          <option key={c} value={c}>{CATEGORIA_LABEL[c] ?? c}</option>
        ))}
      </select>

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
        <option value="">Activo — todos</option>
        <option value="si">Solo activos</option>
        <option value="no">Solo inactivos</option>
      </select>

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

      <button type="button" onClick={onFiltrar} className={`${selectClass} bg-[var(--color-brand-dark)] text-white border-transparent hover:bg-black font-medium ml-auto`}>
        Filtrar
      </button>
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
