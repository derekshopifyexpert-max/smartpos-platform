import { usePaymentProviderAccountsByProvider } from "../hooks/use-payment-provider-accounts";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle } from "lucide-react";

interface PaymentProviderAccountSelectorProps {
  provider: string;
  selectedAccountId: string | null;
  onAccountSelect: (accountId: string) => void;
}

/**
 * Component to select a payment provider account
 * Displays available accounts and shows configuration status
 */
export function PaymentProviderAccountSelector({
  provider,
  selectedAccountId,
  onAccountSelect,
}: PaymentProviderAccountSelectorProps) {
  const { data: accounts, isLoading, error } = usePaymentProviderAccountsByProvider(provider);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Label>Payment Account</Label>
        <div className="animate-pulse space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-slate-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !accounts || accounts.length === 0) {
    return (
      <div className="space-y-3">
        <Label>Payment Account</Label>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            No payment accounts configured for {provider}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Payment Account</Label>

      <RadioGroup value={selectedAccountId || ""} onValueChange={onAccountSelect}>
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                selectedAccountId === account.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
              onClick={() => !account.configured && null}
            >
              <RadioGroupItem
                value={account.id}
                id={account.id}
                disabled={!account.configured}
                className="mt-1"
              />

              <div className="flex-1 min-w-0">
                <label
                  htmlFor={account.id}
                  className={`text-sm font-medium cursor-pointer block ${
                    account.configured ? "text-slate-900" : "text-slate-500"
                  }`}
                >
                  {account.displayName}
                </label>

                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {account.currency}
                  </span>

                  {!account.configured && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      <AlertCircle className="w-3 h-3" />
                      Not Configured
                    </span>
                  )}

                  {account.configured && (
                    <span className="inline-flex text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                      ✓ Active
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </RadioGroup>

      {!selectedAccountId && (
        <p className="text-sm text-slate-500">
          Please select a payment account to continue.
        </p>
      )}

      {selectedAccountId &&
        !accounts.find((a) => a.id === selectedAccountId)?.configured && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700 font-medium">
              ⚠ Selected account is not configured.
            </p>
            <p className="text-xs text-red-600 mt-1">
              Please configure the account before proceeding with payment.
            </p>
          </div>
        )}
    </div>
  );
}
