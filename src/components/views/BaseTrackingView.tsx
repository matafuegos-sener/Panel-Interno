"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, MoreVertical, X } from "lucide-react";
import { LeadBase } from "@/data/leadsBase";
import { CATEGORIA_LABEL, ESTADO_CRM_LABEL } from "@/data/crmUnificado";
import Modal from "@/components/Modal";
import EnvioBadgesBase from "@/components/EnvioBadges";
import { fmtFecha } from "@/lib/fechas";
import { panelCardClass, btnPrimaryClass, btnSecondaryClass, fieldLabelClass, fieldInputClass } from "@/components/formStyles";

// Wrapper fino sobre EnvioBadges (componente compartido con CrmView.tsx) --
// acá se trabaja sobre `LeadBase` directo, no sobre `ContactoUnificado`
// (BaseTrackingView no pasa por el hook unificado).
function EnvioBadges({ lead }: { lead: LeadBase }) {
  return (
    <EnvioBadgesBase
      mailEnviado={lead.mail_enviado}
      mailEnviadoEn={lead.mail_enviado_en}
      whatsappEnviado={lead.whatsapp_enviado}
      whatsappEnviadoEn={lead.whatsapp_enviado_en}
      whatsappSinWa={lead.whatsapp_sin_wa}
      llamadaRealizada={lead.llamada_realizada}
      llamadaRealizadaEn={lead.llamada_realizada_en}
    />
  );
}

const TAMANO_PAGINA = 200;

interface Opciones {
  rubros: string[];
  tiers: string[];
  total: number;
}

const COLUMNAS_CSV: (keyof LeadBase)[] = [
  "nombre",
  "rubro",
  "tier",
  "ciudad",
  "direccion",
  "telefono",
  "whatsapp",
  "email",
  "website",
  "red_social",
  "fuente",
  "notas",
];

function celdaCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (/[",\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function descargarCsv(filas: LeadBase[], rubro: string) {
  const encabezado = COLUMNAS_CSV.join(",");
  const cuerpo = filas.map((f) => COLUMNAS_CSV.map((c) => celdaCsv(f[c])).join(","));
  const csv = [encabezado, ...cuerpo].join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `base-tracking-${rubro || "todos"}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BaseTrackingView() {
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [rubro, setRubro] = useState("");
  const [tier, setTier] = useState("");
  const [medio, setMedio] = useState("");
  const [mailEnviado, setMailEnviado] = useState("");
  const [whatsappEnviado, setWhatsappEnviado] = useState("");
  const [llamadaRealizada, setLlamadaRealizada] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [resultado, setResultado] = useState<LeadBase[] | null>(null);
  const [cargandoLote, setCargandoLote] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [seleccionado, setSeleccionado] = useState<LeadBase | null>(null);
  const [editando, setEditando] = useState<LeadBase | null>(null);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/leads-base/opciones")
      .then((r) => r.json())
      .then((data) => setOpciones(data?.rubros ? data : { rubros: [], tiers: [], total: 0 }));
  }, []);

  function actualizarFila(actualizado: LeadBase) {
    setResultado((prev) => prev?.map((r) => (r.id === actualizado.id ? actualizado : r)) ?? prev);
  }

  async function eliminarFila(fila: LeadBase) {
    setMenuAbierto(null);
    if (!window.confirm(`¿Eliminar "${fila.nombre || "este contacto"}" de la base? No se puede deshacer.`)) return;
    const res = await fetch(`/api/admin/leads-base/${fila.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(`Error al eliminar: ${data.error ?? res.statusText}`);
      return;
    }
    setResultado((prev) => prev?.filter((r) => r.id !== fila.id) ?? prev);
  }

  const lote = useMemo(() => {
    if (!resultado) return null;
    return resultado.slice(pagina * TAMANO_PAGINA, (pagina + 1) * TAMANO_PAGINA);
  }, [resultado, pagina]);

  function limpiarFiltro() {
    setRubro("");
    setTier("");
    setMedio("");
    setMailEnviado("");
    setWhatsappEnviado("");
    setLlamadaRealizada("");
    setBusqueda("");
  }

  async function traerLote() {
    setCargandoLote(true);
    const params = new URLSearchParams();
    if (rubro) params.set("rubro", rubro);
    if (tier) params.set("tier", tier);
    if (medio) params.set("medio", medio);
    if (mailEnviado) params.set("mail_enviado", mailEnviado);
    if (whatsappEnviado) params.set("whatsapp_enviado", whatsappEnviado);
    if (llamadaRealizada) params.set("llamada_realizada", llamadaRealizada);
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

      <div className={`${panelCardClass} p-4 flex flex-col gap-2 mb-6`}>
        {/* Renglón 1: filtros de siempre + búsqueda, "Cargar" y "Descargar CSV" al final. */}
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => resultado && descargarCsv(resultado, rubro)}
            disabled={!resultado || resultado.length === 0}
            className={btnSecondaryClass}
          >
            <Download className="w-4 h-4" />
            Descargar CSV
          </button>
        </div>

        {/* Renglón 2: los 3 filtros de envío, "Limpiar filtro" debajo de "Cargar". */}
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectClass} value={mailEnviado} onChange={(e) => setMailEnviado(e.target.value)}>
            <option value="">Mail — todos</option>
            <option value="si">Mail enviado</option>
            <option value="no">Mail no enviado</option>
          </select>
          <select className={selectClass} value={whatsappEnviado} onChange={(e) => setWhatsappEnviado(e.target.value)}>
            <option value="">WhatsApp — todos</option>
            <option value="si">WhatsApp enviado</option>
            <option value="no">WhatsApp no enviado</option>
          </select>
          <select
            className={selectClass}
            value={llamadaRealizada}
            onChange={(e) => setLlamadaRealizada(e.target.value)}
            title="Todavía no hay ninguna pantalla que marque una llamada como realizada"
          >
            <option value="">Llamada — todas</option>
            <option value="si">Llamada realizada</option>
            <option value="no">Llamada no realizada</option>
          </select>
          <button type="button" onClick={limpiarFiltro} className={`${btnSecondaryClass} ml-auto`}>
            Limpiar filtro
          </button>
        </div>
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
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Categoría</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Mail / WhatsApp</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Teléfono</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Email</th>
                    <th className="px-4 py-3 w-10"></th>
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
                        {CATEGORIA_LABEL[r.categoria] ?? r.categoria}
                        {r.categoria_actualizada_en && <span className="block text-xs">{fmtFecha(r.categoria_actualizada_en)}</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        <EnvioBadges lead={r} />
                      </td>
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
                      <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setMenuAbierto((prev) => (prev === r.id ? null : r.id))}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-brand-dark)] hover:bg-[var(--color-surface-subtle)]"
                          aria-label="Más opciones"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuAbierto === r.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)} />
                            <div className="absolute right-4 top-full mt-1 z-20 w-36 bg-white border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditando(r);
                                  setMenuAbierto(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-[var(--color-brand-dark)] hover:bg-[var(--color-surface-subtle)]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => eliminarFila(r)}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </td>
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

      <Modal open={editando !== null} onClose={() => setEditando(null)} maxWidthClass="max-w-2xl">
        {editando && (
          <LeadEditPanel
            lead={editando}
            onClose={() => setEditando(null)}
            onGuardado={(actualizado) => {
              actualizarFila(actualizado);
              setEditando(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

const selectClass =
  "px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-brand-gray)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)] focus:border-transparent";

const WHATSAPP_LABEL: Record<string, string> = { SI: "Sí", NO: "No", VERIFICAR: "A verificar" };

function LeadPanel({ lead, onClose }: { lead: LeadBase; onClose: () => void }) {
  const campos: [string, string | number | null][] = [
    ["Categoría", `${CATEGORIA_LABEL[lead.categoria] ?? lead.categoria}${lead.categoria_actualizada_en ? ` — ${fmtFecha(lead.categoria_actualizada_en)}` : ""}`],
    ["Estado CRM", lead.estado_crm ? `${ESTADO_CRM_LABEL[lead.estado_crm] ?? lead.estado_crm}${lead.estado_crm_actualizado_en ? ` — ${fmtFecha(lead.estado_crm_actualizado_en)}` : ""}` : null],
    ["Mail enviado", lead.mail_enviado ? (lead.mail_enviado_en ? fmtFecha(lead.mail_enviado_en) : "Sí") : null],
    ["WhatsApp enviado", lead.whatsapp_enviado ? (lead.whatsapp_enviado_en ? fmtFecha(lead.whatsapp_enviado_en) : "Sí") : lead.whatsapp_sin_wa ? "Sin WhatsApp" : null],
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

const CAMPOS_EDITABLES = [
  "nombre",
  "rubro",
  "tier",
  "ciudad",
  "direccion",
  "telefono",
  "whatsapp",
  "email",
  "website",
  "red_social",
  "notas",
] as const;

type FormLead = Record<(typeof CAMPOS_EDITABLES)[number], string>;

function LeadEditPanel({
  lead,
  onClose,
  onGuardado,
}: {
  lead: LeadBase;
  onClose: () => void;
  onGuardado: (actualizado: LeadBase) => void;
}) {
  const [form, setForm] = useState<FormLead>(() =>
    CAMPOS_EDITABLES.reduce((acc, campo) => {
      acc[campo] = lead[campo] ?? "";
      return acc;
    }, {} as FormLead)
  );
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function setCampo(campo: keyof FormLead, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function guardar() {
    setGuardando(true);
    setErrorMsg("");
    const res = await fetch(`/api/admin/leads-base/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setErrorMsg(data.error ?? "No se pudo guardar");
      return;
    }
    onGuardado(data as LeadBase);
  }

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[var(--color-brand-dark)]">Editar contacto</h2>
        <button type="button" onClick={onClose} className="text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="sm:col-span-2">
          <span className={fieldLabelClass}>Empresa</span>
          <input className={fieldInputClass} value={form.nombre} onChange={(e) => setCampo("nombre", e.target.value)} />
        </label>
        <label>
          <span className={fieldLabelClass}>Rubro</span>
          <input className={fieldInputClass} value={form.rubro} onChange={(e) => setCampo("rubro", e.target.value)} />
        </label>
        <label>
          <span className={fieldLabelClass}>Tier</span>
          <input className={fieldInputClass} value={form.tier} onChange={(e) => setCampo("tier", e.target.value)} />
        </label>
        <label>
          <span className={fieldLabelClass}>Teléfono</span>
          <input className={fieldInputClass} value={form.telefono} onChange={(e) => setCampo("telefono", e.target.value)} />
        </label>
        <label>
          <span className={fieldLabelClass}>¿Tiene WhatsApp?</span>
          <select className={fieldInputClass} value={form.whatsapp} onChange={(e) => setCampo("whatsapp", e.target.value)}>
            <option value="">Sin dato</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
            <option value="VERIFICAR">A verificar</option>
          </select>
        </label>
        <label>
          <span className={fieldLabelClass}>Email</span>
          <input className={fieldInputClass} type="email" value={form.email} onChange={(e) => setCampo("email", e.target.value)} />
        </label>
        <label>
          <span className={fieldLabelClass}>Ciudad</span>
          <input className={fieldInputClass} value={form.ciudad} onChange={(e) => setCampo("ciudad", e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className={fieldLabelClass}>Dirección</span>
          <input className={fieldInputClass} value={form.direccion} onChange={(e) => setCampo("direccion", e.target.value)} />
        </label>
        <label>
          <span className={fieldLabelClass}>Website</span>
          <input className={fieldInputClass} value={form.website} onChange={(e) => setCampo("website", e.target.value)} />
        </label>
        <label>
          <span className={fieldLabelClass}>Red social</span>
          <input className={fieldInputClass} value={form.red_social} onChange={(e) => setCampo("red_social", e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className={fieldLabelClass}>Notas</span>
          <textarea className={`${fieldInputClass} resize-y`} rows={3} value={form.notas} onChange={(e) => setCampo("notas", e.target.value)} />
        </label>
      </div>

      {errorMsg && <p className="text-sm text-red-600 mt-4">{errorMsg}</p>}

      <div className="flex gap-3 pt-6 mt-6 border-t border-[var(--color-border-subtle)]">
        <button type="button" onClick={guardar} disabled={guardando} className={btnPrimaryClass}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" onClick={onClose} className={btnSecondaryClass}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
