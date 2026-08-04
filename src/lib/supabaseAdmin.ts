import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente server-only con service role — nunca se expone al browser.
// El panel ya está gateado por adminAuth (cookie), así que las tablas
// no necesitan policies de RLS para anon: se accede exclusivamente desde acá.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
