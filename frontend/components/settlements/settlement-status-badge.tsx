export function SettlementStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const styles: Record<string, string> = {
    SETTLED: "bg-green-100 text-green-800",
    COMPLETED: "bg-green-100 text-green-800",
    CONFIRMED: "bg-green-100 text-green-800",
    CONFIRMING: "bg-blue-100 text-blue-800",
    BROADCASTED: "bg-blue-100 text-blue-800",
    PENDING: "bg-amber-100 text-amber-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    FAILED: "bg-red-100 text-red-800",
    REVERTED: "bg-red-100 text-red-800",
    CANCELED: "bg-slate-100 text-slate-800",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[normalized] || "bg-slate-100 text-slate-800"}`}>
      {normalized}
    </span>
  );
}
