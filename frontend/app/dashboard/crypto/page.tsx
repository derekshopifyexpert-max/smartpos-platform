"use client";

import { LivePriceDisplay } from "@/components/crypto/live-price-display";
import { ProviderBalanceDisplay } from "@/components/crypto/provider-balance-display";
import { CryptoTradingWorkflow } from "@/components/crypto/crypto-trading-workflow";
import { TransactionHistory } from "@/components/crypto/transaction-history";
import { QuidaxProviderStatus } from "@/components/crypto/quidax-provider-status";

export default function CryptoTradingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">SmartPOS</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Crypto Trading</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Buy and sell supported crypto through Quidax. SmartPOS records provider state and
            external wallet destinations without taking custody of customer crypto.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <CryptoTradingWorkflow />

        <QuidaxProviderStatus />

        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <LivePriceDisplay asset="USDT" currency="USD" />
              <ProviderBalanceDisplay asset="USDT" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Quidax operations</h3>
                <div className="space-y-3 text-sm text-slate-600">
                  <p>Provider balances and order status come from authenticated Quidax requests.</p>
                  <p>SmartPOS does not generate customer wallets or hold customer crypto.</p>
                  <p>Withdrawals and blockchain delivery remain unavailable until the verified Quidax contract is configured.</p>
                </div>
              </div>
            </div>
            <TransactionHistory />
        </div>
      </div>
    </div>
  );
}
