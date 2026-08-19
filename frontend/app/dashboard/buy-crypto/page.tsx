"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BuyCryptoCheckout } from "@/components/transak/buy-crypto-checkout";

export default function BuyCryptoPage() {
  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
      <BuyCryptoCheckout />
    </div>
  );
}
