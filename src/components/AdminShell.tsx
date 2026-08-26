"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut, X } from "lucide-react";
import MensajesPredefinidosView from "@/components/views/MensajesPredefinidosView";
import AgendaView from "@/components/views/AgendaView";
import CrmView from "@/components/views/CrmView";
import EnviosMailView from "@/components/views/EnviosMailView";
import WhatsappView from "@/components/views/WhatsappView";
import BaseTrackingView from "@/components/views/BaseTrackingView";
import EnviosActivosView from "@/components/views/EnviosActivosView";
import MetricasView from "@/components/views/MetricasView";
import Modal from "@/components/Modal";
import { useTandasEnvio } from "@/lib/useTandasEnvio";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, btnSecondaryClass, panelCardClass } from "@/components/formStyles";

type NavItem = { id: string; label: string; sub?: boolean };

const ITEM_AGENDA: NavItem = { id: "agenda", label: "Agenda" };
const ITEM_CRM: NavItem = { id: "crm", label: "CRM" };
const MODULO_MAIL: NavItem[] = [
  { id: "envios", label: "Envío de mails" },
  { id: "mensajes-mail", label: "Mensajes predefinidos", sub: true },
];
const MODULO_WHATSAPP: NavItem[] = [
  { id: "whatsapp", label: "Envío de WhatsApp" },
  { id: "mensajes-whatsapp", label: "Mensajes predefinidos", sub: true },
];
const ITEM_BASE_TRACKING: NavItem = { id: "base-tracking", label: "Base Tracking" };
const ITEM_METRICAS: NavItem = { id: "metricas", label: "Web" };

export default function AdminShell() {
  const router = useRouter();
  const [activo, setActivo] = useState("crm");
  const [crearBaseAbierto, setCrearBaseAbierto] = useState(false);
  const tandas = useTandasEnvio();
  const enCursoMail = (tandas ?? []).filter((t) => t.tipo === "mail" && t.estado === "en_curso").length;
  const enCursoWhatsapp = (tandas ?? []).filter((t) => t.tipo === "whatsapp" && t.estado === "en_curso").length;
  const itemEnviosMail: NavItem = { id: "envios-activos-mail", label: enCursoMail > 0 ? `Mails — ${enCursoMail} en curso` : "Mails" };
  const itemEnviosWhatsapp: NavItem = {
    id: "envios-activos-whatsapp",
    label: enCursoWhatsapp > 0 ? `WhatsApp — ${enCursoWhatsapp} en curso` : "WhatsApp",
  };

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  function renderItem(item: NavItem) {
    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => setActivo(item.id)}
          className={`block w-full text-left px-6 border-l-2 transition-colors ${
            item.sub ? "py-1.5 text-xs" : "py-2.5 text-sm"
          } ${
            activo === item.id
              ? "border-[var(--color-brand-red)] text-[var(--color-brand-red)] bg-[var(--color-brand-red-subtle)]"
              : "border-transparent text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]"
          }`}
        >
          {item.label}
        </button>
      </li>
    );
  }

  function renderGrupo(label: string, primero = false) {
    return (
      <li
        className={`px-6 ${
          primero ? "pt-0" : "pt-4 mt-3 border-t border-[var(--color-border-subtle)]"
        } pb-1 type-label text-[var(--color-brand-gray)]`}
      >
        {label}
      </li>
    );
  }

  return (
    <div className="flex min-h-screen">
      <nav className="w-[220px] flex-shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] py-6 flex flex-col">
        <div className="px-6 mb-8">
          <Image src="/logo-sener.png" alt="Matafuegos Sener" width={1004} height={355} style={{ height: "32px", width: "auto" }} priority />
          <p className="type-label text-[var(--color-brand-red)] mt-2">Panel interno</p>
        </div>
        <ul className="flex-1">
          {renderGrupo("Trabajo", true)}
          {renderItem(ITEM_AGENDA)}
          {renderItem(ITEM_CRM)}

          {renderGrupo("Captación clientes")}
          {MODULO_MAIL.map(renderItem)}
          <li className="mt-2">
            <ul>{MODULO_WHATSAPP.map(renderItem)}</ul>
          </li>

          {renderGrupo("Bases")}
          <li>
            <button
              type="button"
              onClick={() => setCrearBaseAbierto(true)}
              className="block w-full text-left px-6 py-2.5 border-l-2 border-transparent text-sm text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-subtle)] transition-colors"
            >
              + Crear nueva base
            </button>
          </li>
          {renderItem(ITEM_BASE_TRACKING)}

          {renderGrupo("Métricas")}
          {renderItem(ITEM_METRICAS)}

          {renderGrupo("Envíos activos")}
          {renderItem(itemEnviosMail)}
          {renderItem(itemEnviosWhatsapp)}
        </ul>
        <div className="px-6 pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
          <p className="type-label text-[var(--color-brand-gray)] opacity-70 mb-3">Settings</p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="flex-1 min-w-0 px-8 py-10 overflow-x-auto">
        {activo === "agenda" && <AgendaView />}
        {activo === "crm" && <CrmView />}
        {activo === "envios" && <EnviosMailView />}
        {activo === "mensajes-mail" && <MensajesPredefinidosView canal="mail" />}
        {activo === "whatsapp" && <WhatsappView />}
        {activo === "mensajes-whatsapp" && <MensajesPredefinidosView canal="whatsapp" />}
        {activo === "base-tracking" && <BaseTrackingView />}
        {activo === "metricas" && <MetricasView />}
        {activo === "envios-activos-mail" && <EnviosActivosView tipo="mail" />}
        {activo === "envios-activos-whatsapp" && <EnviosActivosView tipo="whatsapp" />}
      </main>

      <Modal open={crearBaseAbierto} onClose={() => setCrearBaseAbierto(false)}>
        <CrearBaseForm onCreada={() => setCrearBaseAbierto(false)} onCancelar={() => setCrearBaseAbierto(false)} />
      </Modal>
    </div>
  );
}

// Alta de una base nueva -- catálogo liviano (solo nombre), ver
// supabase/migrations/0016_bases.sql. Cada vista que usa bases (CRM, Base
// Tracking, Envío de mails/WhatsApp) las vuelve a pedir al montar, así que
// no hace falta invalidar nada acá: la próxima vez que se abra cualquiera
// de esas pantallas ya va a aparecer.
function CrearBaseForm({ onCreada, onCancelar }: { onCreada: () => void; onCancelar: () => void }) {
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError("");
    const res = await fetch("/api/admin/bases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim() }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear la base");
      return;
    }
    onCreada();
  }

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[var(--color-brand-dark)]">Crear nueva base</h2>
        <button type="button" onClick={onCancelar} className="text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]">
          <X className="w-5 h-5" />
        </button>
      </div>
      <label>
        <span className={fieldLabelClass}>Nombre de la base</span>
        <input
          className={fieldInputClass}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Consorcios agosto 2026"
          required
        />
      </label>
      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      <div className="flex gap-3 pt-6 mt-6 border-t border-[var(--color-border-subtle)]">
        <button type="button" onClick={guardar} disabled={!nombre.trim() || guardando} className={btnPrimaryClass}>
          {guardando ? "Guardando…" : "Crear base"}
        </button>
        <button type="button" onClick={onCancelar} className={btnSecondaryClass}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
