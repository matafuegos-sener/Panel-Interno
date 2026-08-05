import { isAdminAuthed } from "@/lib/adminAuth";
import AdminLoginForm from "@/components/AdminLoginForm";
import WhatsappTandaView from "@/components/views/WhatsappTandaView";

export default async function WhatsappTandaPage({
  searchParams,
}: {
  searchParams: Promise<{ tandaId?: string }>;
}) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg-warm)] px-4">
        <AdminLoginForm />
      </main>
    );
  }

  const { tandaId } = await searchParams;

  return (
    <main className="min-h-screen bg-[var(--color-bg-warm)] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <WhatsappTandaView tandaId={tandaId ?? ""} />
      </div>
    </main>
  );
}
