const PLACEHOLDER_EMPRESA = "[EMPRESA]";

export function reemplazarVariables(texto: string, nombreEmpresa: string): string {
  return texto.split(PLACEHOLDER_EMPRESA).join(nombreEmpresa);
}

function escapeHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Sintaxis soportada en el editor de mensajes: **negrita** y [texto](url) para
// un link con anchor text. Nada más -- no es un parser de markdown genérico.
export function textoAHtml(texto: string): string {
  const conEtiquetas = escapeHtml(texto)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#1a73e8;">$1</a>');
  return conEtiquetas
    .split(/\n\s*\n/)
    .map((parrafo) => `<p style="margin:0 0 16px 0;">${parrafo.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function textoAPlano(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1: $2");
}
