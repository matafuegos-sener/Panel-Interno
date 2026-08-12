import { fmtFecha } from "@/lib/fechas";

interface EnvioBadgesProps {
  mailEnviado: boolean;
  mailEnviadoEn: string | null;
  whatsappEnviado: boolean;
  whatsappEnviadoEn: string | null;
  whatsappSinWa: boolean;
  llamadaRealizada: boolean;
  llamadaRealizadaEn: string | null;
}

// M / W / L compactos -- reemplaza el badge de texto largo ("Mail —
// 10/08/2026") que no entraba en la tabla apenas se agregó un segundo
// indicador. Coloreado = hecho, gris = no. La fecha va en el `title` nativo
// (tooltip al pasar el mouse), no hace falta un componente de tooltip nuevo.
// "L" (llamada) siempre gris hoy -- no hay ninguna pantalla todavía que la
// marque (ver `llamadaRealizada` en crmUnificado.ts).
export default function EnvioBadges({
  mailEnviado,
  mailEnviadoEn,
  whatsappEnviado,
  whatsappEnviadoEn,
  whatsappSinWa,
  llamadaRealizada,
  llamadaRealizadaEn,
}: EnvioBadgesProps) {
  return (
    <div className="flex items-center gap-1">
      <Letra letra="M" hecho={mailEnviado} titulo={mailEnviado ? `Mail enviado${mailEnviadoEn ? ` — ${fmtFecha(mailEnviadoEn)}` : ""}` : "Mail no enviado"} />
      <Letra
        letra="W"
        hecho={whatsappEnviado}
        mutado={!whatsappEnviado && whatsappSinWa}
        titulo={
          whatsappEnviado
            ? `WhatsApp enviado${whatsappEnviadoEn ? ` — ${fmtFecha(whatsappEnviadoEn)}` : ""}`
            : whatsappSinWa
            ? "Sin WhatsApp"
            : "WhatsApp no enviado"
        }
      />
      <Letra
        letra="L"
        hecho={llamadaRealizada}
        titulo={llamadaRealizada ? `Llamada realizada${llamadaRealizadaEn ? ` — ${fmtFecha(llamadaRealizadaEn)}` : ""}` : "Llamada no realizada"}
      />
    </div>
  );
}

function Letra({ letra, hecho, mutado, titulo }: { letra: string; hecho: boolean; mutado?: boolean; titulo: string }) {
  return (
    <span
      title={titulo}
      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold border cursor-default ${
        hecho
          ? "bg-[var(--color-brand-red)] border-[var(--color-brand-red)] text-white"
          : mutado
          ? "border-[var(--color-border)] text-[var(--color-text-muted)] opacity-40"
          : "border-[var(--color-border)] text-[var(--color-text-muted)]"
      }`}
    >
      {letra}
    </span>
  );
}
