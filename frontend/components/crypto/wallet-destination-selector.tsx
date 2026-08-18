"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Wallet } from "lucide-react";
import { getWallets } from "@/features/wallets/services/wallet.service";
import type { WalletRecord } from "@/features/wallets/types/wallet";

export interface WalletDestinationSelectorProps {
  selectedWalletId?: string;
  onSelect?: (wallet: WalletRecord) => void;
}

function getWalletAddress(wallet: WalletRecord): string {
  if (typeof wallet.address === "string" && wallet.address.trim()) return wallet.address.trim();

  if (Array.isArray(wallet.walletAddresses)) {
    const active = wallet.walletAddresses.find(
      (item) => item && item.isActive !== false && typeof item.address === "string" && item.address.trim()
    );
    if (active?.address) return active.address.trim();

    const first = wallet.walletAddresses.find(
      (item) => item && typeof item.address === "string" && item.address.trim()
    );
    if (first?.address) return first.address.trim();
  }

  return "";
}

export function WalletDestinationSelector({
  selectedWalletId,
  onSelect,
}: WalletDestinationSelectorProps) {
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(selectedWalletId);

  useEffect(() => {
    let mounted = true;

    async function loadWallets() {
      try {
        setLoading(true);
        const data = await getWallets();

        if (!mounted) return;
        setWallets(data || []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Unable to load saved wallets.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadWallets();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedWalletId) setSelectedId(selectedWalletId);
  }, [selectedWalletId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">Loading wallet destinations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Wallet destination</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!wallets.length) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <Wallet className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Wallet destination</h3>
            <p className="text-sm text-amber-700 mt-1">No saved wallets are available for settlement.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Wallet destination</h3>

      <div className="space-y-3">
        {wallets.map((wallet) => {
          const address = getWalletAddress(wallet);
          const isSelected = selectedId === wallet.id;

          return (
            <button
              key={wallet.id}
              onClick={() => {
                setSelectedId(wallet.id);
                onSelect?.(wallet);
              }}
              className={`w-full rounded-xl border p-4 text-left transition ${
                isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{wallet.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {wallet.asset || "USDT"} • {wallet.network || wallet.blockchain?.name || "Unknown network"}
                  </p>
                </div>

                {isSelected && (
                  <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-medium text-white">
                    Selected
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <p>Address: {address || "Unavailable"}</p>
                <p>Status: {wallet.status || "Unknown"}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
