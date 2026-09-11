"use client";

import {
  Check,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  Settings as SettingsIcon,
} from "lucide-react";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, getApiErrorMessage } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";

type ReceiptConfig = {
  payoutNetwork: string;
  payoutAsset: string;
  walletAddress: string;
  merchantEmail: string;
};

const defaultReceiptConfig: ReceiptConfig = {
  payoutNetwork: "TRC20",
  payoutAsset: "USDT",
  walletAddress: "",
  merchantEmail: "",
};

function readReceiptConfig(): ReceiptConfig {
  if (typeof window === "undefined") {
    return defaultReceiptConfig;
  }

  try {
    const rawValue = window.localStorage.getItem("smartpos_receipt_config");
    if (!rawValue) {
      return defaultReceiptConfig;
    }

    const parsed = JSON.parse(rawValue) as Partial<ReceiptConfig>;
    return {
      payoutNetwork: typeof parsed.payoutNetwork === "string" && parsed.payoutNetwork.trim()
        ? parsed.payoutNetwork.trim()
        : defaultReceiptConfig.payoutNetwork,
      payoutAsset: typeof parsed.payoutAsset === "string" && parsed.payoutAsset.trim()
        ? parsed.payoutAsset.trim()
        : defaultReceiptConfig.payoutAsset,
      walletAddress: typeof parsed.walletAddress === "string" ? parsed.walletAddress.trim() : "",
      merchantEmail: typeof parsed.merchantEmail === "string" ? parsed.merchantEmail.trim() : "",
    };
  } catch {
    return defaultReceiptConfig;
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const authenticatedEmail: string =
    typeof user?.email === "string"
      ? user.email
      : getEmailFromToken(token);
  const [email, setEmail] = useState(authenticatedEmail);
  const [currentEmail, setCurrentEmail] = useState(authenticatedEmail);
  const [confirmationEmail, setConfirmationEmail] = useState(authenticatedEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig>(defaultReceiptConfig);
  const [receiptSaved, setReceiptSaved] = useState(false);

  useEffect(() => {
    if (authenticatedEmail && !currentEmail) {
      setCurrentEmail(authenticatedEmail);
      setConfirmationEmail(authenticatedEmail);
      setEmail((value: string) => value || authenticatedEmail);
    }
  }, [authenticatedEmail, currentEmail]);

  useEffect(() => {
    setReceiptConfig(readReceiptConfig());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("smartpos_receipt_config", JSON.stringify(receiptConfig));
  }, [receiptConfig]);

  const passwordRules = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(password) },
    { label: "One number", valid: /\d/.test(password) },
    {
      label: "One special character",
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const passwordIsValid = passwordRules.every((rule) => rule.valid);

  const handleSave = () => {
    setError(null);

    if (!email.trim() || !passwordIsValid) {
      setError("Enter a valid email and meet all password requirements.");
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmChange = async () => {
    setError(null);

    if (!confirmationEmail.trim()) {
      setError("Enter your current email to confirm this change.");
      return;
    }

    setIsSaving(true);

    try {
      await api.patch(ENDPOINTS.auth.credentials, {
        currentEmail: confirmationEmail.trim(),
        currentPassword,
        newPassword: password,
        newEmail: email.trim(),
      });

      logout();
      router.replace("/login");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to update credentials."));
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <SettingsIcon className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Settings
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Account security settings.
            </p>
          </div>
        </div>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <Lock className="h-5 w-5 text-blue-600" />
              Security
            </CardTitle>
          </CardHeader>

          <CardContent className="grid gap-5 p-6 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="security-email"
                className="text-sm font-medium text-slate-700"
              >
                New Username / Email
              </label>

              <Input
                id="security-email"
                type="email"
                value={email}
                onChange={(event) => {
                  const value = event.target.value;
                  setEmail(value);

                  if (!currentEmail) {
                    setCurrentEmail(value);
                  }
                }}
                autoComplete="email"
                className="bg-white text-slate-700"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="security-password"
                className="text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <div className="relative">
                <Input
                  id="security-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  autoComplete="new-password"
                  className="bg-white pr-11 text-slate-700"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <ul className="space-y-1.5 pt-1" aria-label="Password requirements">
                {passwordRules.map((rule) => (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-2 text-xs ${
                      rule.valid ? "text-emerald-600" : "text-slate-500"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {rule.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>

            {error && (
              <p className="md:col-span-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <SettingsIcon className="h-5 w-5 text-blue-600" />
              Receipt setup
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5 p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="receipt-payout-network" className="text-sm font-medium text-slate-700">
                  Payout network
                </label>
                <select
                  id="receipt-payout-network"
                  value={receiptConfig.payoutNetwork}
                  onChange={(event) =>
                    setReceiptConfig((current) => ({
                      ...current,
                      payoutNetwork: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="TRC20">TRC20</option>
                  <option value="ERC20">ERC20</option>
                  <option value="BEP20">BEP20</option>
                  <option value="SOL">SOL</option>
                  <option value="BTC">BTC</option>
                  <option value="LTC">LTC</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="receipt-payout-asset" className="text-sm font-medium text-slate-700">
                  Payout asset
                </label>
                <select
                  id="receipt-payout-asset"
                  value={receiptConfig.payoutAsset}
                  onChange={(event) =>
                    setReceiptConfig((current) => ({
                      ...current,
                      payoutAsset: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                  <option value="BTC">BTC</option>
                  <option value="BNB">BNB</option>
                  <option value="SOL">SOL</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="receipt-email" className="text-sm font-medium text-slate-700">
                  Receipt email
                </label>
                <Input
                  id="receipt-email"
                  type="email"
                  value={receiptConfig.merchantEmail}
                  onChange={(event) =>
                    setReceiptConfig((current) => ({
                      ...current,
                      merchantEmail: event.target.value,
                    }))
                  }
                  placeholder="merchant@smartpos.com"
                  className="bg-white text-slate-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="receipt-wallet-address" className="text-sm font-medium text-slate-700">
                Wallet address
              </label>
              <Input
                id="receipt-wallet-address"
                type="text"
                value={receiptConfig.walletAddress}
                onChange={(event) =>
                  setReceiptConfig((current) => ({
                    ...current,
                    walletAddress: event.target.value,
                  }))
                }
                placeholder="Paste your crypto wallet address"
                className="bg-white text-slate-700"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => {
                  setReceiptConfig(defaultReceiptConfig);
                  setReceiptSaved(true);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("smartpos_receipt_config", JSON.stringify(defaultReceiptConfig));
                  }
                }}
                variant="outline"
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Clear
              </Button>

              <Button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("smartpos_receipt_config", JSON.stringify(receiptConfig));
                  }
                  setReceiptSaved(true);
                }}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Save receipt details
              </Button>
            </div>

            {receiptSaved && (
              <p className="text-sm text-emerald-600">
                Receipt payout and wallet details saved.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-password-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h2 id="confirm-password-title" className="text-lg font-semibold text-slate-900">
              Confirm password change
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Enter your current email and password to authorize this change.
              You will be logged out after it is saved.
            </p>

            <Input
              id="current-email"
              type="email"
              value={confirmationEmail}
              onChange={(event) => setConfirmationEmail(event.target.value)}
              placeholder="Current email"
              autoComplete="email"
              className="mt-5 bg-white"
              autoFocus
            />

            <div className="relative mt-5">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                className="bg-white pr-11"
              />

              <button
                type="button"
                onClick={() => setShowCurrentPassword((visible) => !visible)}
                aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmation(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleConfirmChange}
                disabled={isSaving || currentPassword.length < 8}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm and save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getEmailFromToken(token: string | null) {
  if (!token) {
    return "";
  }

  try {
    const payload = token.split(".")[1];
    const normalizedPayload = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "="
    );
    const decoded = JSON.parse(atob(paddedPayload));

    return typeof decoded.email === "string" ? decoded.email : "";
  } catch {
    return "";
  }
}
