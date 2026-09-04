"use client";

import EnviosActivosPanel from "@/components/EnviosActivosPanel";
import CampanaMailBanner from "@/components/CampanaMailBanner";
import { TandaEnvio } from "@/data/tandas";

const TITULO: Record<TandaEnvio["tipo"], string> = { mail: "Envíos activos — Mails", whatsapp: "Envíos activos — WhatsApp" };
const SUBTITULO: Record<TandaEnvio["tipo"], string> = {
  mail: "Tandas de mail en curso o recién terminadas",
  whatsapp: "Tandas de WhatsApp en curso o recién terminadas",
};

export default function EnviosActivosView({ tipo }: { tipo: TandaEnvio["tipo"] }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">{TITULO[tipo]}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{SUBTITULO[tipo]}</p>
      </div>
      {tipo === "mail" && <CampanaMailBanner />}
      <EnviosActivosPanel tipo={tipo} />
    </div>
  );
}
