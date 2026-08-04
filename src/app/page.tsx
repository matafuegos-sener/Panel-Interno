import { isAdminAuthed } from "@/lib/adminAuth";
import AdminLoginForm from "@/components/AdminLoginForm";
import AdminShell from "@/components/AdminShell";

export default async function Home() {
  const authed = await isAdminAuthed();

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg-warm)] px-4">
        <AdminLoginForm />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-warm)]">
      <AdminShell />
    </main>
  );
}
