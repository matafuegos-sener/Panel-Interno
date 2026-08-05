"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { LeadBase } from "@/data/leadsBase";
import Modal from "@/components/Modal";
import { panelCardClass, btnPrimaryClass, btnSecondaryClass } from "@/components/formStyles";

const TAMANO_PAGINA = 200;

interface Opciones {
  rubros: string[];
  tiers: string[];
  total: number;
}

export default function BaseTrackingView() {
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [rubro, setRubro] = useState("");
  const [tier, setTier] = useState("");
  const [medio, setMedio] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [resultado, setResultado] = useState<LeadBase[] | null>(null);
  const [cargandoLote, setCargandoLote] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [seleccionado, setSeleccionado] = useState<LeadBase | null>(null);

  useEffect(() => {
    fetch("/api/admin/leads-base/opciones")
      .then((r) => r.json())
      .then((data) => setOpciones(data?.rubros ? data : { rubros: [], tiers: [], total: 0 }));
  }, []);

  const lote = useMemo(() => {
    if (!resultado) return null;
    return resultado.slice(pagina * TAMANO_PAGINA, (pagina + 1) * TAMANO_PAGINA);
  }, [resultado, pagina]);

  async function traerLote() {
    setCargandoLote(true);
    const params = new URLSearchParams();
    if (rubro) params.set("rubro", rubro);
    if (tier) params.set("tier", tier);
    if (medio) params.set("medio", medio);
    if (busqueda.trim()) params.set("busqueda", busqueda.trim());

    const res = await fetch(`/api/admin/leads-base?${params.toString()}`);
    const data = await res.json();
    const filtrados = (Array.isArray(data) ? data : []).filter((r: LeadBase) => r.telefono || r.email);
    setResultado(filtrados);
    setPagina(0);
    setCargandoLote(false);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">Base Tracking</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {opciones ? `${opciones.total} contactos con teléfono o email` : "Cargando…"} — traé un lote por criterio y trabajalo, no navegues la base entera
        </p>
      </div>

      <div className={`${panelCardClass} p-4 flex flex-wrap items-center gap-2 mb-6`}>
        <select className={selectClass} value={rubro} onChange={(e) => setRubro(e.target.value)}>
          <option value="">Rubro — todos</option>
          {opciones?.rubros.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select className={selectClass} value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">Tier — todos</option>
          {opciones?.tiers.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className={selectClass} value={medio} onChange={(e) => setMedio(e.target.value)}>
          <option value="">Medio de contacto — todos</option>
          <option value="telefono">Teléfono</option>
          <option value="email">Email</option>
        </select>
        <input
          className={`${selectClass} flex-1 min-w-[160px]`}
          type="search"
          placeholder="Buscar empresa…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && traerLote()}
        />
        <button type="button" onClick={traerLote} disabled={cargandoLote} className={`${btnPrimaryClass} ml-auto`}>
          {cargandoLote ? "Cargando…" : "Cargar"}
        </button>
      </div>

      {cargandoLote && (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">Buscando contactos…</p>
      )}

      {!cargandoLote && resultado === null && (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
          Elegí un criterio y cargá el lote para empezar a trabajar.
        </p>
      )}

      {!cargandoLote && resultado !== null && resultado.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
          Ningún contacto coincide con ese criterio.
        </p>
      )}

      {!cargandoLote && resultado !== null && lote !== null && resultado.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="type-label text-[var(--color-text-muted)]">
              {resultado.length} contactos encontrados — mostrando {pagina * TAMANO_PAGINA + 1}–{pagina * TAMANO_PAGINA + lote.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPagina((p) => p - 1)}
                disabled={pagina === 0}
                className={`${btnSecondaryClass} ${pagina === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                ← Anterior
              </button>
              <button
                type="button"
                onClick={() => setPagina((p) => p + 1)}
                disabled={(pagina + 1) * TAMANO_PAGINA >= resultado.length}
                className={`${btnSecondaryClass} ${(pagina + 1) * TAMANO_PAGINA >= resultado.length ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Siguiente →
              </button>
            </div>
          </div>
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
