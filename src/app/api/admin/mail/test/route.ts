import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { enviarMail } from "@/lib/resend";
import { textoAHtml, textoAPlano } from "@/lib/plantillas";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.destinatario !== "string" ||
    !body.destinatario.trim() ||
    typeof body.asunto !== "string" ||
    typeof body.cuerpo !== "string" ||
    !body.cuerpo.trim()
  ) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const resultado = await enviarMail({
    to: body.destinatario.trim(),
    subject: `[TEST] ${textoAPlano(body.asunto.trim())}`,
    text: textoAPlano(body.cuerpo),
    html: textoAHtml(body.cuerpo),
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: resultado.id });
}
