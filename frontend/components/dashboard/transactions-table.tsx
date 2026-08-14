"use client";

import Link from "next/link";

import {
  ArrowRight,
  CreditCard,
} from "lucide-react";

import { useTransactions } from "@/features/transactions/hooks/use-transactions";

import type {
  Transaction,
} from "@/features/transactions/types/transaction";

export function TransactionsTable() {

  const {
    data,
    isLoading,
  } = useTransactions();

  if (isLoading) {

    return (

      <div className="mt-8 rounded-2xl border bg-white p-6">

        Loading recent activity...

      </div>

    );

  }

  const transactions: Transaction[] =
    Array.isArray(data?.items) ? data.items.slice(0, 5) : [];

  return (

    <div className="mt-8 rounded-2xl border bg-white shadow-sm">

      <div className="flex items-center justify-between border-b p-6">

        <div>

          <h2 className="text-lg font-semibold text-slate-900">

            Recent Activity

          </h2>

          <p className="mt-1 text-sm text-slate-500">

            Latest payment activity

          </p>

        </div>

        <Link
          href="/dashboard/transactions"
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >

          View all

          <ArrowRight size={16} />

        </Link>

      </div>

      <div>

        {transactions.length === 0 ? (

          <div className="p-10 text-center text-slate-500">

            No recent transactions.

          </div>

        ) : (

          transactions.map((tx: Transaction) => (

            <div
              key={tx.id}
              className="flex items-center justify-between border-b p-5 last:border-b-0"
            >

              <div className="flex items-center gap-4">

                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100">

                  <CreditCard
                    size={18}
                    className="text-blue-600"
                  />

                </div>

                <div>

                  <p className="font-medium text-slate-900">

                    {tx.reference ?? "-"}

                  </p>

                  <p className="text-sm text-slate-500">

                    {new Date(
                      tx.createdAt
                    ).toLocaleString()}

                  </p>

                </div>

              </div>

              <div className="text-right">

                <p className="font-semibold text-slate-900">

                  {tx.amount} {tx.currency}

                </p>

                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    tx.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : tx.status === "FAILED"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >

                  {tx.status}

                </span>

              </div>

            </div>

          ))

        )}

      </div>

    </div>

  );

}