"use client";

import { TransactionTable } from "@/components/transactions/transaction-table";

export default function TransactionsPage() {
  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Transactions
        </h1>

      </div>

      <TransactionTable />

    </div>
  );
}
