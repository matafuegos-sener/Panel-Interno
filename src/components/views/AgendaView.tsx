"use client";

import { useEffect, useMemo, useState } from "react";
import { EventoAgenda, TIPO_AGENDA_LABEL, TipoAgendaManual } from "@/data/agenda";
import { Contacto } from "@/data/crm";
import { LeadBase } from "@/data/leadsBase";
import { ContactoUnificado, FILTRO_VACIO, unificarDesdeContactos, unificarDesdeTracking } from "@/data/crmUnificado";
import { useContactosUnificados } from "@/lib/useContactosUnificados";
import Modal from "@/components/Modal";
import EnviosActivosPanel from "@/components/EnviosActivosPanel";
import ContactoPanelCompleto from "@/components/ContactoPanel";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, btnSecondaryClass, panelCardClass } from "@/components/formStyles";

type Vista = "dia" | "semana" | "mes";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const TIPOS_MANUAL: TipoAgendaManual[] = ["llamada", "reunion", "tarea", "recordatorio"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function esHoy(d: Date) {
  return isoDate(d) === isoDate(new Date());
}

function badgeTipo(tipo: string) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)]">
      {TIPO_AGENDA_LABEL[tipo] ?? tipo}
    </span>
  );
}

export default function AgendaView() {
  const [vista, setVista] = useState<Vista>("semana");
  const [fechaBase, setFechaBase] = useState(new Date());
  const [fechaInput, setFechaInput] = useState(isoDate(new Date()));
  const [datos, setDatos] = useState<{ rango: string; eventos: EventoAgenda[] } | null>(null);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);
  const [modalNuevo, setModalNuevo] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<EventoAgenda | null>(null);

  const { desde, hasta } = useMemo(() => {
    if (vista === "dia") return { desde: fechaBase, hasta: fechaBase };
    if (vista === "semana") {
      const ini = startOfWeek(fechaBase);
      return { desde: ini, hasta: addDays(ini, 6) };
    }
    const iniMes = startOfMonth(fechaBase);
    return { desde: startOfWeek(iniMes), hasta: addDays(startOfWeek(endOfMonth(fechaBase)), 6) };
  }, [vista, fechaBase]);

  const rango = `${isoDate(desde)}_${isoDate(hasta)}`;
  const cargando = datos === null || datos.rango !== rango;
  const eventos = datos?.rango === rango ? datos.eventos : null;

  useEffect(() => {
    setFechaInput(isoDate(fechaBase));
  }, [fechaBase]);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/admin/agenda?desde=${isoDate(desde)}&hasta=${isoDate(hasta)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return;
        setDatos({ rango: `${isoDate(desde)}_${isoDate(hasta)}`, eventos: Array.isArray(data) ? data : [] });
      });
    return () => {
      cancelado = true;
    };
  }, [desde, hasta]);

  function eventosDelDia(d: Date): EventoAgenda[] {
    const iso = isoDate(d);
    return (eventos ?? []).filter((e) => e.fecha === iso).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  }

  function mover(delta: number) {
    if (vista === "dia") setFechaBase((f) => addDays(f, delta));
    else if (vista === "semana") setFechaBase((f) => addDays(f, delta * 7));
    else setFechaBase((f) => new Date(f.getFullYear(), f.getMonth() + delta, 1));
  }

  async function marcarCompletada(ev: EventoAgenda, completada: boolean) {
    await fetch(`/api/admin/agenda/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origen: ev.origen, completada }),
    });
    setDatos((prev) => prev && { ...prev, eventos: prev.eventos.map((e) => (e.id === ev.id && e.origen === ev.origen ? { ...e, completada } : e)) });
    setDetalle((prev) => (prev && prev.id === ev.id ? { ...prev, completada } : prev));
  }

  function labelRango(): string {
    if (vista === "dia") return fechaBase.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    if (vista === "semana") {
      const ini = startOfWeek(fechaBase);
      const fin = addDays(ini, 6);
      return `${ini.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} – ${fin.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`;
    }
    return fechaBase.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">Agenda</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Seguimientos del CRM y actividades cargadas a mano</p>
        </div>
        <button type="button" onClick={() => setModalNuevo(isoDate(fechaBase))} className={btnPrimaryClass}>
          + Nueva actividad
        </button>
      </div>

      <h2 className="type-label text-[var(--color-text-muted)] mb-2">Actividades Diarias</h2>

      <div className={`${panelCardClass} p-3 mb-6 flex flex-wrap items-center gap-3`}>
        <button type="button" onClick={() => mover(-1)} className={btnSecondaryClass} aria-label="Anterior">
          ←
        </button>
        <button type="button" onClick={() => setFechaBase(new Date())} className={btnSecondaryClass}>
          Hoy
        </button>
        <button type="button" onClick={() => mover(1)} className={btnSecondaryClass} aria-label="Siguiente">
          →
        </button>
        <span className="font-medium text-[var(--color-brand-dark)] capitalize px-2">{labelRango()}</span>

        <div className="flex gap-1">
          {(["dia", "semana", "mes"] as Vista[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                vista === v
                  ? "bg-[var(--color-brand-red)] text-white border-[var(--color-brand-red)]"
                  : "border-[var(--color-border)] text-[var(--color-brand-gray)] hover:border-[var(--color-brand-red)]"
              }`}
            >
              {v === "dia" ? "Día" : v === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>

        <input
          type="date"
          className="w-40 shrink-0 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-brand-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)] focus:border-transparent"
          value={fechaInput}
          onChange={(e) => setFechaInput(e.target.value)}
        />
        <button
          type="button"
          onClick={() => fechaInput && setFechaBase(parseIsoDate(fechaInput))}
          className={btnSecondaryClass}
        >
          Buscar
        </button>
      </div>

      {cargando && <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">Cargando…</p>}

      {!cargando && vista === "dia" && (
        <VistaDia eventos={eventosDelDia(fechaBase)} onAbrir={setDetalle} onCompletar={marcarCompletada} />
      )}
      {!cargando && vista === "semana" && (
        <VistaSemana inicio={startOfWeek(fechaBase)} eventosDelDia={eventosDelDia} onAbrir={setDetalle} />
      )}
      {!cargando && vista === "mes" && (
        <VistaMes
          mes={fechaBase}
          eventosDelDia={eventosDelDia}
          onAbrirDia={(d) => {
            setFechaBase(d);
            setVista("dia");
          }}
        />
      )}

      <div className="mt-6 mb-6">
        <h2 className="type-label text-[var(--color-text-muted)] mb-2">Envíos en curso</h2>
        <EnviosActivosPanel estado="en_curso" limite={5} />
      </div>

      <div>
        <button type="button" onClick={() => setMostrarFinalizados((v) => !v)} className={btnSecondaryClass}>
          {mostrarFinalizados ? "Ocultar envíos finalizados" : "Envíos finalizados"}
        </button>
        {mostrarFinalizados && (
          <div className="mt-3">
            <EnviosActivosPanel estado="completado" />
          </div>
        )}
      </div>

      <Modal open={modalNuevo !== null} onClose={() => setModalNuevo(null)}>
        {modalNuevo !== null && (
          <PanelNuevaActividad
            fechaInicial={modalNuevo}
            onCreado={(nuevo) => {
              setDatos((prev) => (prev ? { ...prev, eventos: [...prev.eventos, nuevo] } : { rango, eventos: [nuevo] }));
              setModalNuevo(null);
            }}
            onCancelar={() => setModalNuevo(null)}
          />
        )}
      </Modal>

      <Modal open={detalle !== null} onClose={() => setDetalle(null)}>
        {detalle && <PanelDetalle evento={detalle} onCompletar={(v) => marcarCompletada(detalle, v)} onClose={() => setDetalle(null)} />}
      </Modal>
    </div>
  );
}

function FilaEvento({
  ev,
  onAbrir,
  onCompletar,
}: {
  ev: EventoAgenda;
  onAbrir: (e: EventoAgenda) => void;
  onCompletar: (v: boolean) => void;
}) {
  return (
    <div
      className={`p-3 flex items-start gap-3 rounded-2xl shadow-xl border ${
        ev.completada ? "bg-green-50 border-green-200" : "bg-[var(--color-surface)] border-[var(--color-border)]"
      }`}
    >
      <input
        type="checkbox"
        checked={ev.completada}
        onChange={(e) => onCompletar(e.target.checked)}
        className="mt-1 accent-[var(--color-brand-red)]"
      />
      <button type="button" onClick={() => onAbrir(ev)} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-medium text-[var(--color-brand-dark)]">{ev.hora ? ev.hora.slice(0, 5) : "Todo el día"}</span>
          {badgeTipo(ev.tipo)}
        </div>
        <p className="text-sm text-[var(--color-brand-dark)]">{ev.nota}</p>
        {ev.contactoNombre && <p className="text-xs text-[var(--color-text-muted)]">{ev.contactoNombre}</p>}
      </button>
    </div>
  );
}

function VistaDia({
  eventos,
  onAbrir,
  onCompletar,
}: {
  eventos: EventoAgenda[];
  onAbrir: (e: EventoAgenda) => void;
  onCompletar: (ev: EventoAgenda, v: boolean) => void;
}) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-12 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
        Nada agendado para este día.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {eventos.map((ev) => (
        <FilaEvento key={`${ev.origen}-${ev.id}`} ev={ev} onAbrir={onAbrir} onCompletar={(v) => onCompletar(ev, v)} />
      ))}
    </div>
  );
}

function VistaSemana({
  inicio,
  eventosDelDia,
  onAbrir,
}: {
  inicio: Date;
  eventosDelDia: (d: Date) => EventoAgenda[];
  onAbrir: (e: EventoAgenda) => void;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
      {dias.map((d) => {
        const evs = eventosDelDia(d);
        return (
          <div key={isoDate(d)} className={`${panelCardClass} p-3 ${esHoy(d) ? "border-2 border-[var(--color-brand-red)]" : ""}`}>
            <p className="type-label text-[var(--color-text-muted)] mb-2">
              {DIAS_SEMANA[(d.getDay() + 6) % 7]} <span className="text-[var(--color-brand-dark)]">{d.getDate()}</span>
            </p>
            <div className="flex flex-col gap-1.5">
              {evs.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">—</p>}
              {evs.map((ev) => (
                <button
                  key={`${ev.origen}-${ev.id}`}
                  type="button"
                  onClick={() => onAbrir(ev)}
                  className={`text-left text-xs p-2 rounded-lg border transition-colors ${
                    ev.completada
                      ? "bg-green-50 border-green-200"
                      : "bg-[var(--color-bg-warm)] border-[var(--color-border-subtle)] hover:border-[var(--color-brand-red)]"
                  }`}
                >
                  <span className="font-medium">{ev.hora ? ev.hora.slice(0, 5) : "Todo el día"}</span> — {ev.nota}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VistaMes({
  mes,
  eventosDelDia,
  onAbrirDia,
}: {
  mes: Date;
  eventosDelDia: (d: Date) => EventoAgenda[];
  onAbrirDia: (d: Date) => void;
}) {
  const inicioGrilla = startOfWeek(startOfMonth(mes));
  const dias = Array.from({ length: 42 }, (_, i) => addDays(inicioGrilla, i));
  const mesActual = mes.getMonth();
  const MAX_VISIBLE = 3;

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 mb-1">
        {DIAS_SEMANA.map((d) => (
          <p key={d} className="type-label text-[var(--color-text-muted)] text-center">
            {d}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {dias.map((d) => {
          const evs = eventosDelDia(d);
          const fueraDeMes = d.getMonth() !== mesActual;
          return (
            <button
              key={isoDate(d)}
              type="button"
              onClick={() => onAbrirDia(d)}
              className={`text-left p-2 rounded-lg border min-h-[84px] transition-colors hover:bg-[var(--color-surface-subtle)] ${
                esHoy(d) ? "border-2 border-[var(--color-brand-red)]" : "border-[var(--color-border-subtle)]"
              } ${fueraDeMes ? "opacity-40" : ""}`}
            >
              <span className="text-xs font-medium text-[var(--color-brand-dark)]">{d.getDate()}</span>
              <div className="mt-1 flex flex-col gap-0.5">
                {evs.slice(0, MAX_VISIBLE).map((ev) => (
                  <span
                    key={`${ev.origen}-${ev.id}`}
                    className={`block text-[10px] truncate px-1 py-0.5 rounded ${
                      ev.completada ? "bg-green-50" : "bg-[var(--color-bg-warm)]"
                    }`}
                  >
                    {ev.nota}
                  </span>
                ))}
                {evs.length > MAX_VISIBLE && <span className="text-[10px] text-[var(--color-text-muted)]">+{evs.length - MAX_VISIBLE} más</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PanelNuevaActividad({
  fechaInicial,
  onCreado,
  onCancelar,
}: {
  fechaInicial: string;
  onCreado: (ev: EventoAgenda) => void;
  onCancelar: () => void;
}) {
  const { buscarLote } = useContactosUnificados();
  const [tipo, setTipo] = useState<TipoAgendaManual>("tarea");
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [todoElDia, setTodoElDia] = useState(true);
  const [hora, setHora] = useState("10:00");
  const [duracion, setDuracion] = useState(30);
  const [busquedaContacto, setBusquedaContacto] = useState("");
  const [resultados, setResultados] = useState<ContactoUnificado[] | null>(null);
  const [contactoElegido, setContactoElegido] = useState<ContactoUnificado | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function buscarContacto() {
    if (!busquedaContacto.trim()) return;
    setBuscando(true);
    const encontrados = await buscarLote({ ...FILTRO_VACIO, busqueda: busquedaContacto.trim() });
    setResultados(encontrados.slice(0, 5));
    setBuscando(false);
  }

  async function guardar() {
    if (!nota.trim()) return;
    setGuardando(true);
    const res = await fetch("/api/admin/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        nota: nota.trim(),
        fecha,
        hora: todoElDia ? null : hora,
        duracionMinutos: todoElDia ? null : duracion,
        contactoId: contactoElegido?.id ?? null,
        tabla: contactoElegido?.tabla ?? null,
      }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      window.alert(`Error: ${data.error}`);
      return;
    }
    onCreado({
      id: data.id,
      origen: "manual",
      tipo: data.tipo,
      nota: data.nota,
      fecha: data.fecha,
      hora: data.hora,
      duracionMinutos: data.duracion_minutos,
      completada: data.completada,
      contactoId: data.contacto_id,
      tabla: data.tabla_origen,
      contactoNombre: contactoElegido?.nombre ?? null,
    });
  }

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <h2 className="text-lg font-bold text-[var(--color-brand-dark)] mb-4">Nueva actividad</h2>
      <div className="flex flex-col gap-4">
        <label>
          <span className={fieldLabelClass}>Tipo</span>
          <select className={fieldInputClass} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAgendaManual)}>
            {TIPOS_MANUAL.map((t) => (
              <option key={t} value={t}>
                {TIPO_AGENDA_LABEL[t]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={fieldLabelClass}>Nota</span>
          <textarea className={`${fieldInputClass} resize-y`} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} required />
        </label>

        <div className="flex flex-wrap gap-4 items-end">
          <label>
            <span className={fieldLabelClass}>Fecha</span>
            <input type="date" className={fieldInputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 pb-2.5">
            <input type="checkbox" checked={todoElDia} onChange={(e) => setTodoElDia(e.target.checked)} className="accent-[var(--color-brand-red)]" />
            <span className="text-sm">Todo el día</span>
          </label>
          {!todoElDia && (
            <>
              <label>
                <span className={fieldLabelClass}>Hora</span>
                <input type="time" className={fieldInputClass} value={hora} onChange={(e) => setHora(e.target.value)} />
              </label>
              <label className="w-32">
                <span className={fieldLabelClass}>Duración (min)</span>
                <input
                  type="number"
                  min={5}
                  step={5}
                  className={fieldInputClass}
                  value={duracion}
                  onChange={(e) => setDuracion(Number(e.target.value) || 30)}
                />
              </label>
            </>
          )}
        </div>

        <div>
          <span className={fieldLabelClass}>Contacto asociado (opcional)</span>
          {contactoElegido ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm px-2 py-1 rounded bg-[var(--color-bg-warm)] border border-[var(--color-border-subtle)]">
                {contactoElegido.nombre}
              </span>
              <button
                type="button"
                onClick={() => setContactoElegido(null)}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)] underline"
              >
                quitar
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-1">
              <input
                className={`${fieldInputClass} flex-1`}
                placeholder="Buscar por nombre…"
                value={busquedaContacto}
                onChange={(e) => setBusquedaContacto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarContacto();
                  }
                }}
              />
              <button type="button" onClick={buscarContacto} disabled={buscando} className={btnSecondaryClass}>
                Buscar
              </button>
            </div>
          )}
          {resultados && !contactoElegido && (
            <div className="flex flex-col gap-1 mt-2">
              {resultados.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Sin resultados.</p>}
              {resultados.map((c) => (
                <button
                  key={`${c.tabla}-${c.id}`}
                  type="button"
                  onClick={() => {
                    setContactoElegido(c);
                    setResultados(null);
                  }}
                  className="text-left text-sm px-2 py-1.5 rounded hover:bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)]"
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
          <button type="button" onClick={guardar} disabled={!nota.trim() || guardando} className={btnPrimaryClass}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={onCancelar} className={btnSecondaryClass}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelDetalle({
  evento,
  onCompletar,
  onClose,
}: {
  evento: EventoAgenda;
  onCompletar: (v: boolean) => void;
  onClose: () => void;
}) {
  const [contacto, setContacto] = useState<ContactoUnificado | null>(null);
  const [cargandoContacto, setCargandoContacto] = useState(false);

  // Antes el nombre de la empresa era solo texto -- no había forma de llegar
  // a sus datos (teléfono, mail, historial) desde un evento de agenda sin
  // salir a buscarlo a mano en CRM/Base Tracking. Se trae recién al hacer
  // click, no de entrada -- este modal se abre por cada evento del día/semana
  // y la mayoría no se van a expandir.
  async function abrirContacto() {
    if (!evento.contactoId || !evento.tabla) return;
    setCargandoContacto(true);
    const res = await fetch(`/api/admin/crm/contactos/${evento.contactoId}?tabla=${evento.tabla}`);
    const data = await res.json();
    setCargandoContacto(false);
    if (!res.ok || !data.fila) {
      window.alert(`No se pudo cargar la empresa: ${data.error ?? res.statusText}`);
      return;
    }
    const unificado =
      evento.tabla === "contactos" ? unificarDesdeContactos(data.fila as Contacto) : unificarDesdeTracking(data.fila as LeadBase);
    setContacto(unificado);
  }

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {badgeTipo(evento.tipo)}
        {evento.origen === "manual" && (
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Cargado a mano</span>
        )}
      </div>
      <p className="text-sm text-[var(--color-brand-dark)] mb-1 capitalize">
        {parseIsoDate(evento.fecha).toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })}
        {evento.hora ? ` — ${evento.hora.slice(0, 5)}` : " — Todo el día"}
      </p>
      {evento.contactoNombre && evento.contactoId && evento.tabla && (
        <button
          type="button"
          onClick={abrirContacto}
          disabled={cargandoContacto}
          className="block text-left text-lg font-bold text-[var(--color-brand-dark)] mb-3 hover:underline disabled:no-underline disabled:opacity-60"
        >
          {cargandoContacto ? "Cargando…" : evento.contactoNombre}
        </button>
      )}
      {evento.contactoNombre && (!evento.contactoId || !evento.tabla) && (
        <p className="text-lg font-bold text-[var(--color-brand-dark)] mb-3">{evento.contactoNombre}</p>
      )}
      <p className="text-base text-[var(--color-brand-dark)] whitespace-pre-line mb-6">{evento.nota}</p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={evento.completada} onChange={(e) => onCompletar(e.target.checked)} className="accent-[var(--color-brand-red)]" />
        <span className="text-sm">Completada</span>
      </label>

      <Modal open={contacto !== null} onClose={() => setContacto(null)} maxWidthClass="max-w-2xl">
        {contacto && <ContactoPanelCompleto unificado={contacto} onClose={() => setContacto(null)} />}
      </Modal>
      <button type="button" onClick={onClose} className={`${btnSecondaryClass} mt-6`}>
        Cerrar
      </button>
    </div>
  );
}
