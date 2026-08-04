"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import MensajesPredefinidosView from "@/components/views/MensajesPredefinidosView";
import CrmView from "@/components/views/CrmView";
import PlaceholderView from "@/components/views/PlaceholderView";

type NavEntry =
  | { kind: "group"; label: string }
  | { kind: "item"; id: string; label: string; sub?: boolean };

const NAV: NavEntry[] = [
  { kind: "group", label: "Trabajo" },
  { kind: "item", id: "crm", label: "CRM" },
  { kind: "group", label: "Captación clientes" },
  { kind: "item", id: "envios", label: "Envío de mails" },
  { kind: "item", id: "mensajes-mail", label: "Mensajes predefinidos", sub: true },
  { kind: "item", id: "whatsapp", label: "WhatsApp" },
  { kind: "item", id: "mensajes-whatsapp", label: "Mensajes predefinidos", sub: true },
];

export default function AdminShell() {
  const router = useRouter();
  const [activo, setActivo] = useState("crm");

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <nav className="w-[220px] flex-shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] py-6 flex flex-col">
        <p className="type-label text-[var(--color-brand-red)] px-6 mb-8">Panel interno · Sener</p>
        <ul className="flex-1">
          {NAV.map((entry, i) =>
            entry.kind === "group" ? (
              <li key={i} className={`px-6 ${i === 0 ? "pt-0" : "pt-4"} pb-1 type-label text-[var(--color-text-muted)]`}>
                {entry.label}
              </li>
            ) : (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setActivo(entry.id)}
                  className={`block w-full text-left px-6 py-2.5 border-l-2 text-sm transition-colors ${
                    entry.sub ? "pl-9 py-1.5" : ""
                  } ${
                    activo === entry.id
                      ? "border-[var(--color-brand-red)] text-[var(--color-brand-red)] bg-[var(--color-brand-red-subtle)]"
                      : "border-transparent text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]"
                  }`}
                >
                  {entry.label}
                </button>
              </li>
            )
          )}
        </ul>
        <div className="px-6 pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
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
        {activo === "envios" && (
          <PlaceholderView titulo="Envío de mails" descripcion="Captación clientes — tandas de mail" />
        )}
        {activo === "mensajes-mail" && <MensajesPredefinidosView canal="mail" />}
        {activo === "whatsapp" && (
          <PlaceholderView titulo="WhatsApp" descripcion="Captación clientes — tandas de WhatsApp" />
        )}
        {activo === "mensajes-whatsapp" && <MensajesPredefinidosView canal="whatsapp" />}
      </main>
    </div>
  );
}
