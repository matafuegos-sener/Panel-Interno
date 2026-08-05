"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import MensajesPredefinidosView from "@/components/views/MensajesPredefinidosView";
import AgendaView from "@/components/views/AgendaView";
import CrmView from "@/components/views/CrmView";
import EnviosMailView from "@/components/views/EnviosMailView";
import WhatsappView from "@/components/views/WhatsappView";
import BaseTrackingView from "@/components/views/BaseTrackingView";
import EnviosActivosView from "@/components/views/EnviosActivosView";
import { useTandasEnvio } from "@/lib/useTandasEnvio";

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

export default function AdminShell() {
  const router = useRouter();
  const [activo, setActivo] = useState("crm");
  const tandas = useTandasEnvio();
  const enCurso = (tandas ?? []).filter((t) => t.estado === "en_curso").length;
  const itemEnviosActivos: NavItem = { id: "envios-activos", label: enCurso > 0 ? `${enCurso} en curso` : "Envíos activos" };

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
          {renderItem(ITEM_BASE_TRACKING)}

          {renderGrupo("Envíos activos")}
          {renderItem(itemEnviosActivos)}
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
        {activo === "envios-activos" && <EnviosActivosView />}
      </main>
    </div>
  );
}
