"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Accion, Contacto, Interaccion, TIPO_INTERACCION } from "@/data/crm";
import { LeadBase } from "@/data/leadsBase";
import { CATEGORIA_LABEL, ContactoUnificado } from "@/data/crmUnificado";
import { useContactosUnificados } from "@/lib/useContactosUnificados";
import FiltrosContactos, { FILTRO_VACIO, FiltroContactosState, aplicaFiltro } from "@/components/FiltrosContactos";
import Modal from "@/components/Modal";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, btnSecondaryClass, panelCardClass } from "@/components/formStyles";

function fmtFecha(d: string): string {
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const WHATSAPP_LABEL: Record<string, string> = { SI: "Sí", NO: "No", VERIFICAR: "A verificar" };

export default function CrmView() {
  const { contactos, tracking, unificados } = useContactosUnificados();
  const [filtro, setFiltro] = useState<FiltroContactosState>(FILTRO_VACIO);
  const [lote, setLote] = useState<ContactoUnificado[] | null>(null);
  const [seleccionado, setSeleccionado] = useState<ContactoUnificado | null>(null);

  function traerLote() {
    if (!unificados) return;
    setLote(unificados.filter((r) => aplicaFiltro(r, filtro)).slice(0, 100));
  }

  const rawContacto = useMemo(() => {
    if (!seleccionado || seleccionado.tabla !== "contactos" || !contactos) return null;
    return contactos.find((c) => c.id === seleccionado.id) ?? null;
  }, [seleccionado, contactos]);

  const rawTracking = useMemo(() => {
    if (!seleccionado || seleccionado.tabla !== "leads_base" || !tracking) return null;
    return tracking.find((t) => t.id === seleccionado.id) ?? null;
  }, [seleccionado, tracking]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">CRM</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Traé un lote por criterio y trabajalo — no navegues la base entera</p>
      </div>

      <div className={`${panelCardClass} p-4 mb-6`}>
        <FiltrosContactos rows={unificados ?? []} value={filtro} onChange={setFiltro} onFiltrar={traerLote} mostrarBusqueda />
      </div>

      {unificados === null && (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">Cargando contactos…</p>
      )}

      {unificados !== null && lote === null && (
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
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Categoría</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.map((r) => (
                    <tr
                      key={`${r.tabla}-${r.id}`}
                      className="border-b border-[var(--color-border-subtle)] last:border-0 cursor-pointer hover:bg-[var(--color-surface-subtle)] transition-colors"
                      onClick={() => setSeleccionado(r)}
                    >
                      <td className="px-4 py-3 font-medium text-[var(--color-brand-dark)]">{r.nombre}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.rubro || "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.tier || "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{CATEGORIA_LABEL[r.categoria] ?? r.categoria}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.telefono || <em className="text-xs">sin dato</em>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={seleccionado !== null} onClose={() => setSeleccionado(null)} maxWidthClass="max-w-2xl">
        {seleccionado && (
          <ContactoPanel
            unificado={seleccionado}
            rawContacto={rawContacto}
            rawTracking={rawTracking}
            onClose={() => setSeleccionado(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function ContactoPanel({
  unificado,
  rawContacto,
  rawTracking,
  onClose,
}: {
  unificado: ContactoUnificado;
  rawContacto: Contacto | null;
  rawTracking: LeadBase | null;
  onClose: () => void;
}) {
  const { id, tabla } = unificado;
  const [interacciones, setInteracciones] = useState<Interaccion[] | null>(null);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [nombreContacto, setNombreContacto] = useState(rawContacto?.contacto ?? "");
  const [guardandoContacto, setGuardandoContacto] = useState(false);

  const [tipo, setTipo] = useState(Object.keys(TIPO_INTERACCION)[0]);
  const [detalle, setDetalle] = useState("");
  const [accionesNuevas, setAccionesNuevas] = useState([{ descripcion: "", fecha_ejecucion: "" }]);
  const [registrando, setRegistrando] = useState(false);

  function cargarHistorial() {
    fetch(`/api/admin/crm/contactos/${id}?tabla=${tabla}`)
      .then((r) => r.json())
      .then((data) => {
        setInteracciones(data.interacciones ?? []);
        setAcciones(data.acciones ?? []);
      });
  }

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tabla]);

  async function guardarContacto() {
    setGuardandoContacto(true);
    await fetch(`/api/admin/crm/contactos/${id}?tabla=contactos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacto: nombreContacto.trim() || null }),
    });
    setGuardandoContacto(false);
  }

  async function registrarInteraccion(e: React.FormEvent) {
    e.preventDefault();
    setRegistrando(true);
    await fetch(`/api/admin/crm/contactos/${id}/interacciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabla, tipo, detalle: detalle.trim(), acciones: accionesNuevas }),
    });
    setDetalle("");
    setAccionesNuevas([{ descripcion: "", fecha_ejecucion: "" }]);
    setRegistrando(false);
    cargarHistorial();
  }

  const camposTracking: [string, string | number | null][] = rawTracking
    ? [
        ["Ciudad", rawTracking.ciudad],
        ["Dirección", rawTracking.direccion],
        ["¿Tiene WhatsApp?", rawTracking.whatsapp ? WHATSAPP_LABEL[rawTracking.whatsapp] ?? rawTracking.whatsapp : null],
        ["Website", rawTracking.website],
        ["Red social", rawTracking.red_social],
        ["Rating", rawTracking.rating],
        ["Reviews", rawTracking.reviews],
        ["Matrícula", rawTracking.matricula],
        ["Fecha inscripción", rawTracking.fecha_inscripcion],
        ["Notas", rawTracking.notas],
      ]
    : [];

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-brand-dark)]">{unificado.nombre}</h2>
          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs border border-[var(--color-border)] text-[var(--color-text-muted)]">
            {CATEGORIA_LABEL[unificado.categoria] ?? unificado.categoria}
          </span>
        </div>
        <button type="button" onClick={onClose} className="text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]">
          <X className="w-5 h-5" />
        </button>
      </div>

      {tabla === "contactos" ? (
        <div className="flex flex-wrap items-end gap-4 pb-6 mb-6 border-b border-[var(--color-border-subtle)]">
          <label className="min-w-[200px]">
            <span className={fieldLabelClass}>Persona de contacto</span>
            <input className={fieldInputClass} value={nombreContacto} onChange={(e) => setNombreContacto(e.target.value)} placeholder="Nombre de quien atiende" />
          </label>
          <p className="text-sm text-[var(--color-text-muted)]"><span className="type-label mr-1">Tel</span>{unificado.telefono || "sin dato"}</p>
          <p className="text-sm text-[var(--color-text-muted)]"><span className="type-label mr-1">Mail</span>{unificado.email || "sin dato"}</p>
          <button type="button" onClick={guardarContacto} disabled={guardandoContacto} className={btnSecondaryClass}>
            Guardar persona de contacto
          </button>
        </div>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pb-6 mb-6 border-b border-[var(--color-border-subtle)]">
          <div>
            <dt className="type-label text-[var(--color-text-muted)]">Teléfono</dt>
            <dd className="text-sm text-[var(--color-brand-dark)]">{unificado.telefono || "sin dato"}</dd>
          </div>
          <div>
            <dt className="type-label text-[var(--color-text-muted)]">Email</dt>
            <dd className="text-sm text-[var(--color-brand-dark)]">{unificado.email || "sin dato"}</dd>
          </div>
          {camposTracking
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
      )}

      {acciones.length > 0 && (
        <div className="p-4 rounded-lg bg-[var(--color-brand-red-subtle)] mb-6">
          <h3 className="type-label text-[var(--color-text-muted)] mb-2">Pendiente con este contacto</h3>
          {acciones.map((a) => (
            <p key={a.id} className="text-sm mb-1">
              {a.descripcion} — <strong>{fmtFecha(a.fecha_ejecucion)}</strong>
            </p>
          ))}
        </div>
      )}

      <div className="mb-6">
        <h3 className="type-label text-[var(--color-text-muted)] mb-3">Registrar contacto de hoy</h3>
        <form onSubmit={registrarInteraccion} className="flex flex-col gap-2 items-start">
          <select className={`${fieldInputClass} w-full`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(TIPO_INTERACCION).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <textarea
            className={`${fieldInputClass} resize-y`}
            rows={2}
            placeholder="Qué se habló, qué pasó…"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            required
          />
          {accionesNuevas.map((a, i) => (
            <div key={i} className="flex gap-2 w-full">
              <input
                className={`${fieldInputClass} flex-1`}
                placeholder="Próxima acción (opcional) — ej: llamar por revisión"
                value={a.descripcion}
                onChange={(e) => setAccionesNuevas((prev) => prev.map((x, idx) => (idx === i ? { ...x, descripcion: e.target.value } : x)))}
              />
              <input
                type="date"
                className={fieldInputClass}
                value={a.fecha_ejecucion}
                onChange={(e) => setAccionesNuevas((prev) => prev.map((x, idx) => (idx === i ? { ...x, fecha_ejecucion: e.target.value } : x)))}
              />
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)] underline"
            onClick={() => setAccionesNuevas((prev) => [...prev, { descripcion: "", fecha_ejecucion: "" }])}
          >
            + agregar otra acción
          </button>
          <button type="submit" disabled={registrando} className={btnPrimaryClass}>
            {registrando ? "Registrando…" : "Registrar"}
          </button>
        </form>
      </div>

      <div>
        <h3 className="type-label text-[var(--color-text-muted)] mb-3">Historial</h3>
        {interacciones === null && <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>}
        {interacciones && interacciones.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">Sin interacciones registradas todavía.</p>
        )}
        <div className="flex flex-col gap-3">
          {interacciones?.map((it) => (
            <div key={it.id} className="p-3 rounded-lg bg-[var(--color-bg-warm)] border border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-[var(--color-text-muted)]">{fmtFecha(it.fecha)}</span>
                <span className="text-xs px-1.5 py-0.5 border border-[var(--color-border)] rounded">{TIPO_INTERACCION[it.tipo] ?? it.tipo}</span>
              </div>
              <p className="text-sm mb-1">{it.detalle}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{it.registrado_por}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
