"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { LeadBase } from "@/data/leadsBase";
import Modal from "@/components/Modal";
import { panelCardClass, btnPrimaryClass } from "@/components/formStyles";

function normalizarBusqueda(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function BaseTrackingView() {
  const [todos, setTodos] = useState<LeadBase[] | null>(null);
  const [rubro, setRubro] = useState("");
  const [tier, setTier] = useState("");
  const [fuente, setFuente] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [lote, setLote] = useState<LeadBase[] | null>(null);
  const [seleccionado, setSeleccionado] = useState<LeadBase | null>(null);

  useEffect(() => {
    fetch("/api/admin/leads-base")
      .then((r) => r.json())
      .then((data) => setTodos(Array.isArray(data) ? data : []));
  }, []);

  const rubros = useMemo(() => uniqueSorted(todos ?? [], "rubro"), [todos]);
  const tiers = useMemo(() => uniqueSorted(todos ?? [], "tier"), [todos]);
  const fuentes = useMemo(() => uniqueSorted(todos ?? [], "fuente"), [todos]);

  function traerLote() {
    if (!todos) return;
    const q = normalizarBusqueda(busqueda.trim());
    const resultado = todos
      .filter((r) => {
        if (rubro && r.rubro !== rubro) return false;
        if (tier && r.tier !== tier) return false;
        if (fuente && r.fuente !== fuente) return false;
        if (q) {
          const nombre = normalizarBusqueda(r.nombre ?? "");
          if (!nombre.includes(q)) return false;
        }
        return true;
      })
      .slice(0, 200);
    setLote(resultado);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">Base Tracking</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {todos ? `${todos.length} contactos trackeados` : "Cargando…"} — traé un lote por criterio y trabajalo, no navegues la base entera
        </p>
      </div>

      <div className={`${panelCardClass} p-4 flex flex-wrap items-center gap-2 mb-6`}>
        <select className={selectClass} value={rubro} onChange={(e) => setRubro(e.target.value)}>
          <option value="">Rubro — todos</option>
          {rubros.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select className={selectClass} value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">Tier — todos</option>
          {tiers.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className={selectClass} value={fuente} onChange={(e) => setFuente(e.target.value)}>
          <option value="">Fuente — todas</option>
          {fuentes.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <input
          className={`${selectClass} flex-1 min-w-[160px]`}
          type="search"
          placeholder="Buscar empresa…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && traerLote()}
        />
        <button type="button" onClick={traerLote} className={`${btnPrimaryClass} ml-auto`}>
          Cargar
        </button>
      </div>

      {lote === null && (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
          Elegí un criterio y cargá el lote para empezar a trabajar.
        </p>
      )}

      {lote !== null && lote.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
          Ningún contacto coincide con ese criterio.
        </p>
      )}

      {lote !== null && lote.length > 0 && (
        <>
          <p className="type-label text-[var(--color-text-muted)] mb-3">{lote.length} contactos traídos — hacé click para abrir cada uno</p>
          <div className={`${panelCardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)]">
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Empresa</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Rubro</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Tier</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Teléfono</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--color-border-subtle)] last:border-0 cursor-pointer hover:bg-[var(--color-surface-subtle)] transition-colors"
                      onClick={() => setSeleccionado(r)}
                    >
                      <td className="px-4 py-3 font-medium text-[var(--color-brand-dark)]">{r.nombre || <em className="text-xs">sin dato</em>}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.rubro || "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.tier || "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        {r.telefono ? (
                          <>
                            {r.telefono}
                            {r.whatsapp === "SI" && (
                              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-[var(--color-brand-red-subtle)] text-[var(--color-brand-red)]">WA</span>
                            )}
                          </>
                        ) : (
                          <em className="text-xs">sin dato</em>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.email || <em className="text-xs">sin dato</em>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={seleccionado !== null} onClose={() => setSeleccionado(null)} maxWidthClass="max-w-2xl">
        {seleccionado && <LeadPanel lead={seleccionado} onClose={() => setSeleccionado(null)} />}
      </Modal>
    </div>
  );
}

const selectClass =
  "px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-brand-gray)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)] focus:border-transparent";

function uniqueSorted(rows: LeadBase[], key: "rubro" | "tier" | "fuente"): string[] {
  return [...new Set(rows.map((r) => r[key]).filter((v): v is string => !!v))].sort();
}

const WHATSAPP_LABEL: Record<string, string> = { SI: "Sí", NO: "No", VERIFICAR: "A verificar" };

function LeadPanel({ lead, onClose }: { lead: LeadBase; onClose: () => void }) {
  const campos: [string, string | number | null][] = [
    ["Rubro", lead.rubro],
    ["Ciudad", lead.ciudad],
    ["Dirección", lead.direccion],
    ["Teléfono", lead.telefono],
    ["¿Tiene WhatsApp?", lead.whatsapp ? WHATSAPP_LABEL[lead.whatsapp] ?? lead.whatsapp : null],
    ["Email", lead.email],
    ["Website", lead.website],
    ["Red social", lead.red_social],
    ["Rating", lead.rating],
    ["Reviews", lead.reviews],
    ["Tier", lead.tier],
    ["Fuente", lead.fuente],
    ["Matrícula", lead.matricula],
    ["Fecha inscripción", lead.fecha_inscripcion],
    ["Oneroso", lead.oneroso],
    ["Sanciones", lead.sanciones],
    ["Notas", lead.notas],
  ];

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[var(--color-brand-dark)]">{lead.nombre || "Sin nombre"}</h2>
        <button type="button" onClick={onClose} className="text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]">
          <X className="w-5 h-5" />
        </button>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {campos
          .filter(([, valor]) => valor !== null && valor !== undefined && valor !== "")
          .map(([label, valor]) => (
            <div key={label}>
              <dt className="type-label text-[var(--color-text-muted)]">{label}</dt>
              <dd className="text-sm text-[var(--color-brand-dark)]">
                {label === "Website" || label === "Red social" ? (
                  <a href={String(valor)} target="_blank" rel="noreferrer" className="text-[var(--color-brand-red)] hover:underline break-all">
                    {valor}
                  </a>
                ) : (
                  valor
                )}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
