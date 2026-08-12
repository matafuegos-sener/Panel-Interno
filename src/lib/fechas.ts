// `fecha_ejecucion` (acciones) y `vigencia_hasta` (contactos/leads_base) son
// columnas `date` de Postgres -- "2026-08-10" sin hora ni huso. `new
// Date("2026-08-10")` lo interpreta como medianoche UTC, y en Argentina
// (UTC-3) eso cae en el día anterior al convertir a hora local -- por eso
// "10" se mostraba como "9". Para fechas puras se arma el label a mano, sin
// pasar por Date. Los demás campos (`categoria_actualizada_en`,
// `mail_enviado_en`, `whatsapp_enviado_en`, `interacciones.fecha`) son
// `timestamptz` reales y sí necesitan la conversión a horario local.
export function fmtFecha(d: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [anio, mes, dia] = d.split("-");
    return `${dia}/${mes}/${anio}`;
  }
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
