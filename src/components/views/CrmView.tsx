"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Accion, Contacto, Interaccion, TIPO_INTERACCION } from "@/data/crm";
import Modal from "@/components/Modal";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, btnSecondaryClass, panelCardClass } from "@/components/formStyles";

function normalizarBusqueda(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function fmtFecha(d: string): string {
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function CrmView() {
  const [todos, setTodos] = useState<Contacto[] | null>(null);
  const [tipo, setTipo] = useState("");
  const [provincia, setProvincia] = useState("");
  const [activo, setActivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [lote, setLote] = useState<Contacto[] | null>(null);
  const [seleccionado, setSeleccionado] = useState<Contacto | null>(null);

  useEffect(() => {
    fetch("/api/admin/crm/contactos")
      .then((r) => r.json())
      .then((data) => setTodos(Array.isArray(data) ? data : []));
  }, []);

  const tipos = useMemo(() => uniqueSorted(todos ?? [], "tipo_perfil"), [todos]);
  const provincias = useMemo(() => uniqueSorted(todos ?? [], "provincia"), [todos]);

  function traerLote() {
    if (!todos) return;
    const q = normalizarBusqueda(busqueda.trim());
    const resultado = todos
      .filter((r) => {
        if (tipo && r.tipo_perfil !== tipo) return false;
        if (provincia && r.provincia !== provincia) return false;
        if (activo === "si" && !r.activo) return false;
        if (activo === "no" && r.activo) return false;
        if (q) {
          const nombre = normalizarBusqueda(`${r.razon_social ?? ""} ${r.nombre_comercial ?? ""}`);
          if (!nombre.includes(q)) return false;
        }
        return true;
      })
      .slice(0, 100);
    setLote(resultado);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">CRM</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Traé un lote por criterio y trabajalo — no navegues la base entera</p>
      </div>

      <div className={`${panelCardClass} p-4 flex flex-wrap items-center gap-2 mb-6`}>
        <select className={selectClass} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tipo — todos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className={selectClass} value={provincia} onChange={(e) => setProvincia(e.target.value)}>
          <option value="">Provincia — todas</option>
          {provincias.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select className={selectClass} value={activo} onChange={(e) => setActivo(e.target.value)}>
          <option value="">Todos</option>
          <option value="si">Solo activos</option>
          <option value="no">Solo inactivos</option>
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
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Persona de contacto</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--color-border-subtle)] last:border-0 cursor-pointer hover:bg-[var(--color-surface-subtle)] transition-colors"
                      onClick={() => setSeleccionado(r)}
                    >
                      <td className="px-4 py-3 font-medium text-[var(--color-brand-dark)]">{r.razon_social || r.nombre_comercial || "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.contacto || <em className="text-xs">sin dato</em>}</td>
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
        {seleccionado && <ContactoPanel contacto={seleccionado} onClose={() => setSeleccionado(null)} />}
      </Modal>
    </div>
  );
}

const selectClass =
  "px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-brand-gray)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)] focus:border-transparent";

function uniqueSorted(rows: Contacto[], key: "tipo_perfil" | "provincia"): string[] {
  return [...new Set(rows.map((r) => r[key]).filter((v): v is string => !!v))].sort();
}

function ContactoPanel({ contacto, onClose }: { contacto: Contacto; onClose: () => void }) {
  const [interacciones, setInteracciones] = useState<Interaccion[] | null>(null);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [nombreContacto, setNombreContacto] = useState(contacto.contacto ?? "");
  const [guardandoContacto, setGuardandoContacto] = useState(false);

  const [tipo, setTipo] = useState(Object.keys(TIPO_INTERACCION)[0]);
  const [detalle, setDetalle] = useState("");
  const [accionesNuevas, setAccionesNuevas] = useState([{ descripcion: "", fecha_ejecucion: "" }]);
  const [registrando, setRegistrando] = useState(false);

  function cargarHistorial() {
    setInteracciones(null);
    fetch(`/api/admin/crm/contactos/${contacto.id}`)
      .then((r) => r.json())
      .then((data) => {
        setInteracciones(data.interacciones ?? []);
        setAcciones(data.acciones ?? []);
      });
  }

  useEffect(cargarHistorial, [contacto.id]);

  async function guardarContacto() {
    setGuardandoContacto(true);
    await fetch(`/api/admin/crm/contactos/${contacto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacto: nombreContacto.trim() || null }),
    });
    setGuardandoContacto(false);
  }

  async function registrarInteraccion(e: React.FormEvent) {
    e.preventDefault();
    setRegistrando(true);
    await fetch(`/api/admin/crm/contactos/${contacto.id}/interacciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, detalle: detalle.trim(), acciones: accionesNuevas }),
    });
    setDetalle("");
    setAccionesNuevas([{ descripcion: "", fecha_ejecucion: "" }]);
    setRegistrando(false);
    cargarHistorial();
  }

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[var(--color-brand-dark)]">{contacto.razon_social || contacto.nombre_comercial}</h2>
        <button type="button" onClick={onClose} className="text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-4 pb-6 mb-6 border-b border-[var(--color-border-subtle)]">
        <label className="min-w-[200px]">
          <span className={fieldLabelClass}>Persona de contacto</span>
          <input className={fieldInputClass} value={nombreContacto} onChange={(e) => setNombreContacto(e.target.value)} placeholder="Nombre de quien atiende" />
        </label>
        <p className="text-sm text-[var(--color-text-muted)]"><span className="type-label mr-1">Tel</span>{contacto.telefono || "sin dato"}</p>
        <p className="text-sm text-[var(--color-text-muted)]"><span className="type-label mr-1">Mail</span>{contacto.mail_1 || "sin dato"}</p>
        <button type="button" onClick={guardarContacto} disabled={guardandoContacto} className={btnSecondaryClass}>
          Guardar persona de contacto
        </button>
      </div>

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
          <select className={`${selectClass} w-full`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
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
