"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, Plus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">SmartPOS</p>
          <h1 className="text-3xl font-bold text-slate-900">Payments</h1>
        </div>

        <Link href="/dashboard/payments/new">
          <Button className="gap-2" size="lg">
            <Plus className="h-4 w-4" />
            New Payment
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                <CreditCard className="h-4 w-4" />
              </div>
              <CardTitle>Quick action</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Create a new payment, select the destination wallet, and launch the secure Paystack flow.
            </p>
            <Link href="/dashboard/payments/new" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline">
              Start a payment
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <Wallet className="h-4 w-4" />
              </div>
              <CardTitle>Wallets</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Manage the saved wallets used for crypto settlement and destination selection.
            </p>
            <Link href="/dashboard/wallets" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline">
              Open wallets
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
