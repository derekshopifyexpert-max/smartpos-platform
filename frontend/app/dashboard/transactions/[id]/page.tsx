"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Eye,
  Loader2,
  Printer,
  Trash2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTransaction } from "@/features/transactions/hooks/use-transaction";
import { deleteTransactions } from "@/features/transactions/services/transaction.service";
import type { Transaction } from "@/features/transactions/types/transaction";
import { getApiErrorMessage } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth.store";

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = String(params.id);
  const user = useAuthStore((state) => state.user);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState(user?.email ?? "");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: transaction,
    isLoading,
    isError,
  } = useTransaction(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-10 w-72 animate-pulse rounded bg-slate-200" />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
        </div>

        <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (isError || !transaction) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Transactions
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Unable to load this transaction.
        </div>
      </div>
    );
  }

  const status = transaction.status?.toUpperCase() ?? "UNKNOWN";

  function handleViewReceipt() {
    if (!transaction) {
      return;
    }

    const config = readReceiptConfig();
    const receiptHtml = buildReceiptHtml(transaction, config);
    const previewWindow = window.open("", "_blank", "width=430,height=900");

    if (!previewWindow) {
      return;
    }

    previewWindow.document.write(receiptHtml);
    previewWindow.document.close();
    previewWindow.focus();
  }

  async function handlePrintReceipt() {
    if (!transaction) {
      return;
    }

    const config = readReceiptConfig();
    const receiptText = buildThermalReceiptText(transaction, config);
    const printer: { printText?: (text: string) => void; printImage?: (base64: string) => void; isPrinterConnected?: () => boolean } | undefined =
      typeof window !== "undefined" ? (window as typeof window & { SmartPOSHardware?: { printText?: (text: string) => void; printImage?: (base64: string) => void; isPrinterConnected?: () => boolean } }).SmartPOSHardware : undefined;

    if (printer?.isPrinterConnected && printer.isPrinterConnected()) {
      try {
        const imageDataUrl = await generateReceiptImage(transaction, config);
        if (printer.printImage && imageDataUrl.startsWith("data:image/")) {
          const base64 = imageDataUrl.split(",")[1] ?? "";
          if (base64) {
            printer.printImage(base64);
            return;
          }
        }
      } catch {
        // Fall through to text printing if image generation fails.
      }

      printer.printText?.(receiptText);
      return;
    }

    const printWindow = window.open("", "_blank", "width=420,height=900");
    if (!printWindow) {
      return;
    }

    printWindow.document.write(buildReceiptHtml(transaction, config));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 400);
    }, 300);
  }

  async function handleDelete() {
    if (!deleteEmail.trim() || deletePassword.length < 8) {
      setDeleteError("Enter your current email and password.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteTransactions({
        currentEmail: deleteEmail.trim(),
        currentPassword: deletePassword,
        ids: [id],
      });

      await queryClient.invalidateQueries({
        queryKey: ["transactions"],
      });
      queryClient.removeQueries({
        queryKey: ["transaction", id],
      });

      router.replace("/dashboard/transactions");
    } catch (requestError) {
      setDeleteError(getApiErrorMessage(requestError, "Unable to delete transaction."));
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/transactions"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Transactions
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <p className="text-sm font-medium text-blue-600">
                Transaction
              </p>

              <StatusBadge status={status} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {transaction.reference ?? transaction.id}
            </h1>

            <p className="mt-2 font-mono text-sm text-slate-500">
              {transaction.id}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Transaction Date
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDate(transaction.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleViewReceipt}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" />
              View receipt
            </button>

            <button
              type="button"
              onClick={handlePrintReceipt}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Print receipt
            </button>

            <button
              type="button"
              onClick={() => {
                setDeleteEmail(user?.email ?? "");
                setDeletePassword("");
                setDeleteError(null);
                setShowDeleteDialog(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete transaction
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SummaryCard
          label="Amount"
          value={formatAmount(
            transaction.amount,
            transaction.currency
          )}
          icon={<CreditCard size={20} />}
        />

        <SummaryCard
          label="Payment Method"
          value={transaction.paymentMethod ?? "-"}
          icon={<CreditCard size={20} />}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Transaction Information
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Core information associated with this transaction.
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem
            label="Transaction ID"
            value={transaction.id}
            mono
          />

          <InfoItem
            label="Reference"
            value={transaction.reference ?? "-"}
            mono
          />

          <InfoItem
            label="Payment Intent ID"
            value={transaction.paymentIntentId ?? "-"}
            mono
          />

          <InfoItem
            label="Amount"
            value={formatAmount(
              transaction.amount,
              transaction.currency
            )}
          />

          <InfoItem
            label="Currency"
            value={transaction.currency}
          />

          <InfoItem
            label="Status"
            value={status}
          />

          <InfoItem
            label="Type"
            value={transaction.type ?? "-"}
          />

          <InfoItem
            label="Payment Method"
            value={transaction.paymentMethod ?? "-"}
          />

          <InfoItem
            label="Created"
            value={formatDate(transaction.createdAt)}
          />

          <InfoItem
            label="Updated"
            value={
              transaction.updatedAt
                ? formatDate(transaction.updatedAt)
                : "-"
            }
          />

        </div>
      </section>

      {transaction.description && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Description
            </h2>
          </div>

          <div className="p-6 text-sm text-slate-700">
            {transaction.description}
          </div>
        </section>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-transaction-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h2 id="delete-transaction-title" className="text-lg font-semibold text-slate-900">
              Delete this transaction?
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Enter your current login details to confirm this deletion.
            </p>

            <div className="mt-5 space-y-3">
              <input
                type="email"
                value={deleteEmail}
                onChange={(event) => setDeleteEmail(event.target.value)}
                placeholder="Current email"
                autoComplete="email"
                autoFocus
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {deleteError && <p className="mt-3 text-sm text-red-600" role="alert">{deleteError}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ReceiptConfig = {
  payoutNetwork: string;
  payoutAsset?: string;
  walletAddress: string;
  merchantEmail: string;
};

function readReceiptConfig(): ReceiptConfig {
  if (typeof window === "undefined") {
    return {
      payoutNetwork: "TRC20",
      payoutAsset: "USDT",
      walletAddress: "",
      merchantEmail: "",
    };
  }

  try {
    const saved = window.localStorage.getItem("smartpos_receipt_config");
    if (!saved) {
      return {
        payoutNetwork: "TRC20",
        payoutAsset: "USDT",
        walletAddress: "",
        merchantEmail: "",
      };
    }

    const parsed = JSON.parse(saved) as { payoutNetwork?: string; payoutAsset?: string; walletAddress?: string; merchantEmail?: string };
    return {
      payoutNetwork: parsed.payoutNetwork || "TRC20",
      payoutAsset: parsed.payoutAsset || "USDT",
      walletAddress: parsed.walletAddress || "",
      merchantEmail: parsed.merchantEmail || "",
    };
  } catch {
    return {
      payoutNetwork: "TRC20",
      payoutAsset: "USDT",
      walletAddress: "",
      merchantEmail: "",
    };
  }
}

function maskEmail(value: string) {
  const normalized = value.trim();
  if (!normalized) return "***@gmail.com";

  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) {
    return `${normalized.slice(0, 3)}***`;
  }

  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);
  const visibleLocalPart = localPart.slice(0, Math.min(3, localPart.length));

  return `${visibleLocalPart}${"*".repeat(Math.max(3, localPart.length - 3))}@${domainPart || "gmail.com"}`;
}

function maskIdentifier(value: string, keepStart = 4, keepEnd = 4) {
  const normalized = value.trim();
  if (!normalized) return "********";
  if (normalized.length <= keepStart + keepEnd) {
    return `${normalized.slice(0, keepStart)}${"*".repeat(Math.max(6, normalized.length - keepStart))}`;
  }

  const start = normalized.slice(0, keepStart);
  const end = normalized.slice(-keepEnd);
  const maskedMiddle = "*".repeat(Math.max(8, normalized.length - keepStart - keepEnd));
  return `${start}${maskedMiddle}${end}`;
}

function maskCardNumber(value?: string | null) {
  const normalized = (value ?? "").trim();
  if (!normalized) return "**** **** **** 0000";
  const lastFour = normalized.replace(/\D/g, "").slice(-4) || "0000";
  return `**** **** **** ${lastFour}`;
}

function formatReceiptStatus(value: string | undefined) {
  const normalized = (value ?? "UNKNOWN").toUpperCase();

  if (["APPROVED", "SUCCESS", "SUCCEEDED", "SETTLED", "CAPTURED", "PAID", "AUTHORIZED", "COMPLETED"].includes(normalized)) {
    return "Approved";
  }

  if (["PENDING", "PROCESSING", "INITIATED"].includes(normalized)) {
    return "Pending";
  }

  if (["FAILED", "ERROR", "DECLINED", "DISPUTED"].includes(normalized)) {
    return "Declined";
  }

  if (["REJECTED", "CANCELLED", "CANCELED"].includes(normalized)) {
    return "Rejected";
  }

  return "Pending";
}

function normalizeCardType(value?: string | null) {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "Card";
  if (raw.includes("visa")) return "Visa";
  if (raw.includes("master") || raw.includes("maestro")) return "Master";
  if (raw.includes("verve")) return "Verve";
  if (raw.includes("amex")) return "Amex";
  return "Card";
}

function normalizeTransactionType(value?: string | null) {
  const raw = (value ?? "Card").trim();
  if (!raw) return "Card";
  const normalized = raw.toLowerCase();
  if (normalized.includes("card")) return "Card";
  if (normalized.includes("wallet")) return "Wallet";
  return "Card";
}

function buildPayoutLabel(config: ReceiptConfig) {
  const network = config.payoutNetwork || "TRC20";
  const asset = config.payoutAsset || "USDT";
  return `${asset} (${network})`;
}

function buildReceiptLines(transaction: Transaction, config: ReceiptConfig) {
  const dateValue = new Date(transaction.createdAt).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const transactionEmail = config.merchantEmail || transaction.customer?.email || "merchant@smartpos.com";
  const walletValue = config.walletAddress ? maskIdentifier(config.walletAddress) : "********";
  const authCode = transaction.authorizationCode || transaction.approvalCode || transaction.authCode || "****";

  return [
    { label: "Date", value: dateValue },
    { label: "TXN ID", value: transaction.id },
    { label: "Terminal Type", value: "Online (Manual)" },
    { label: "Transaction Type", value: normalizeTransactionType(transaction.type ?? transaction.paymentMethod ?? "Card Payment") },
    { label: "Email", value: maskEmail(transactionEmail) },
    { label: "Card No.", value: maskCardNumber(transaction.cardLastFour) },
    { label: "CVV.", value: "***" },
    { label: "Card Type", value: normalizeCardType(transaction.cardBrand ?? transaction.paymentMethod) },
    { label: "Amount", value: formatAmount(transaction.amount, transaction.currency) },
    { label: "Currency", value: transaction.currency },
    { label: "Payout", value: buildPayoutLabel(config) },
    { label: "Wallet", value: walletValue },
    { label: "Authn Code", value: authCode },
    { label: "Transaction Status", value: formatReceiptStatus(transaction.status) },
  ];
}

function buildReceiptHtml(transaction: Transaction, config: ReceiptConfig) {
  const lines = buildReceiptLines(transaction, config);
  const rowsHtml = lines
    .map((line) => `
      <div class="row">
        <span class="label">${escapeHtml(line.label)}</span>
        <span class="value">${escapeHtml(line.value)}</span>
      </div>
    `)
    .join("");

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>SmartPOS Receipt</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f5f7fa;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            padding: 20px;
          }
          .receipt {
            width: 100%;
            max-width: 390px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px 18px 14px 18px;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 12px 10px 10px;
            border-radius: 12px 12px 0 0;
            background: linear-gradient(135deg, #071827 0%, #0f172a 100%);
            color: #ffffff;
          }
          .brand-mark {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            object-fit: cover;
            flex-shrink: 0;
            background: rgba(255,255,255,0.08);
            padding: 4px;
          }
          .title {
            font-size: 25px;
            font-weight: 800;
            letter-spacing: 0.04em;
            margin: 0;
            color: #ffffff;
          }
          .copy {
            margin-top: 2px;
            font-size: 11px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.72);
          }
          .divider {
            border-top: 1px dashed #cbd5e1;
            margin: 12px 0 14px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 6px 0;
            font-size: 12px;
            line-height: 1.5;
          }
          .label {
            color: #475569;
            font-weight: 700;
            flex: 0 0 46%;
          }
          .value {
            flex: 1;
            text-align: right;
            word-break: break-word;
            font-weight: 600;
            color: #111827;
          }
          .footer {
            margin-top: 12px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <img class="brand-mark" src="/smartpos-logo.svg" alt="SmartPOS logo" />
            <div>
              <h1 class="title">SmartPOS</h1>
              <div class="copy">Customer Copy</div>
            </div>
          </div>
          <div class="divider"></div>
          ${rowsHtml}
          <div class="footer">Thank you for your transaction</div>
        </div>
      </body>
    </html>`;
}

async function generateReceiptImage(transaction: Transaction, config: ReceiptConfig): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 760;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas unavailable");
  }

  context.fillStyle = "#f5f7fa";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const logo = await loadImage("/smartpos-logo.svg");
  context.fillStyle = "#071827";
  context.fillRect(0, 0, canvas.width, 110);
  context.drawImage(logo, 24, 18, 72, 72);
  context.fillStyle = "#ffffff";
  context.font = "700 28px Arial";
  context.fillText("SmartPOS", 112, 52);
  context.font = "600 11px Arial";
  context.fillStyle = "rgba(255,255,255,0.8)";
  context.fillText("CUSTOMER COPY", 112, 76);

  const lines = buildReceiptLines(transaction, config);
  let y = 146;
  const lineHeight = 24;

  context.fillStyle = "#111827";
  context.font = "600 12px Arial";

  for (const line of lines) {
    const label = `${line.label}:`;
    const value = truncateReceiptValue(line.value, 26);
    context.fillStyle = "#475569";
    context.fillText(label, 20, y);
    context.fillStyle = "#111827";
    context.fillText(value, 150, y, 240);
    y += lineHeight;
  }

  context.strokeStyle = "#cbd5e1";
  context.beginPath();
  context.moveTo(20, y + 12);
  context.lineTo(canvas.width - 20, y + 12);
  context.stroke();

  context.fillStyle = "#64748b";
  context.font = "600 11px Arial";
  context.fillText("THANK YOU FOR YOUR TRANSACTION", 82, y + 40);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function buildThermalReceiptText(transaction: Transaction, config: ReceiptConfig) {
  const lines = buildReceiptLines(transaction, config);
  const maxLabel = Math.max(...lines.map((line) => line.label.length));
  const lineSeparator = "-".repeat(38);
  const esc = "\u001b";
  const center = `${esc}a1`;
  const left = `${esc}a0`;
  const bold = `${esc}E1`;
  const normal = `${esc}E0`;
  const header = `${center}${bold}SMARTPOS${normal}\n${center}CUSTOMER COPY\n${left}${lineSeparator}\n`;

  const body = lines
    .map((line) => {
      const label = line.label.padEnd(maxLabel, " ");
      return `${label} ${line.value}`;
    })
    .join("\n");

  return `${header}${body}\n${lineSeparator}\n${left}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncateReceiptValue(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">
          {label}
        </p>

        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          {icon}
        </div>
      </div>

      <p className="mt-4 truncate text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-sm font-medium text-slate-900 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = status.toUpperCase();

  const styles =
    normalized === "SETTLED" ||
    normalized === "SUCCESS" ||
    normalized === "SUCCEEDED" ||
    normalized === "AUTHORIZED" ||
    normalized === "CAPTURED" ||
    normalized === "APPROVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "PENDING" || normalized === "PENDING_REVIEW"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : normalized === "FAILED" || normalized === "DECLINED"
          ? "border-red-200 bg-red-50 text-red-700"
          : normalized === "CANCELLED" || normalized === "CANCELED"
            ? "border-slate-200 bg-slate-100 text-slate-700"
            : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}
    >
      {normalized}
    </span>
  );
}

function formatAmount(
  amount: number | string,
  currency: string
) {
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toLocaleString()} ${currency}`;
  }
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}
