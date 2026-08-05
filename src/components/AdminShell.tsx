"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import MensajesPredefinidosView from "@/components/views/MensajesPredefinidosView";
import CrmView from "@/components/views/CrmView";
import EnviosMailView from "@/components/views/EnviosMailView";
import WhatsappView from "@/components/views/WhatsappView";
import BaseTrackingView from "@/components/views/BaseTrackingView";

type NavItem = { id: string; label: string; sub?: boolean };

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

  function renderPlaceholder(label: string) {
    return (
      <li>
        <div className="block px-6 py-2.5 text-sm border-l-2 border-transparent text-[var(--color-text-muted)] opacity-50 cursor-default select-none">
          {label}
        </div>
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
          {renderPlaceholder("Agenda")}
          {renderItem(ITEM_CRM)}

          {renderGrupo("Captación clientes")}
          {MODULO_MAIL.map(renderItem)}
          <li className="mt-2">
            <ul>{MODULO_WHATSAPP.map(renderItem)}</ul>
          </li>

          {renderGrupo("Bases")}
          {renderItem(ITEM_BASE_TRACKING)}

          {renderGrupo("Envíos activos")}
          {renderPlaceholder("Ningún envío activo")}
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
        {activo === "crm" && <CrmView />}
        {activo === "envios" && <EnviosMailView />}
        {activo === "mensajes-mail" && <MensajesPredefinidosView canal="mail" />}
        {activo === "whatsapp" && <WhatsappView />}
        {activo === "mensajes-whatsapp" && <MensajesPredefinidosView canal="whatsapp" />}
        {activo === "base-tracking" && <BaseTrackingView />}
      </main>
    </div>
  );
}
