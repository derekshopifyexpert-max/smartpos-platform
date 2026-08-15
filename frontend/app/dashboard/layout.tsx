import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />

      <section className="min-w-0 flex-1 bg-slate-50">
        <Topbar />

        <div className="p-6 lg:p-8">
          {children}
        </div>
      </section>
    </main>
  );
}