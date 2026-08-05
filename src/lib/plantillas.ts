const PLACEHOLDER_EMPRESA = "[EMPRESA]";

export function reemplazarVariables(texto: string, nombreEmpresa: string): string {
  return texto.split(PLACEHOLDER_EMPRESA).join(nombreEmpresa);
}
