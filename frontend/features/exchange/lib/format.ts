/**
 * Format a decimal string (from Prisma.Decimal) to a readable format
 */
export function formatCrypto(
  value: string | number | undefined,
  decimals: number = 2
): string {
  if (!value) return "0.00";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00";

  return num.toFixed(decimals);
}

/**
 * Format fiat currency (NGN)
 */
export function formatFiat(
  value: string | number | undefined,
  currency: string = "NGN"
): string {
  if (!value) return `${currency} 0.00`;

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return `${currency} 0.00`;

  return `${currency} ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Parse a string decimal value
 */
export function parseDecimal(value: string | number): number {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

/**
 * Calculate estimated crypto from fiat amount
 */
export function calculateEstimatedCrypto(
  fiatAmount: string | number,
  rate: string | number
): number {
  const amount = parseDecimal(fiatAmount);
  const price = parseDecimal(rate);

  if (price === 0) return 0;
  return amount / price;
}

/**
 * Calculate estimated fiat from crypto amount
 */
export function calculateEstimatedFiat(
  cryptoAmount: string | number,
  rate: string | number
): number {
  const amount = parseDecimal(cryptoAmount);
  const price = parseDecimal(rate);

  return amount * price;
}

/**
 * Check if a quote is expired
 */
export function isQuoteExpired(expiresAt: string): boolean {
  try {
    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    return now > expiryTime;
  } catch {
    return true;
  }
}

/**
 * Get time remaining in seconds
 */
export function getTimeRemaining(expiresAt: string): number {
  try {
    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));
    return remaining;
  } catch {
    return 0;
  }
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Expired";
  return `${seconds}s`;
}

/**
 * Get status color
 */
export function getStatusColor(
  status: string
): "success" | "warning" | "error" | "info" {
  switch (status.toUpperCase()) {
    case "FILLED":
    case "CONFIRMED":
    case "SETTLED":
    case "SUCCESS":
      return "success";
    case "PENDING":
    case "OPEN":
    case "PARTIALLY_FILLED":
    case "BROADCASTED":
    case "CONFIRMING":
      return "warning";
    case "FAILED":
    case "CANCELED":
    case "REJECTED":
    case "REVERTED":
      return "error";
    default:
      return "info";
  }
}

/**
 * Get status label
 */
export function getStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case "PENDING":
      return "Pending";
    case "OPEN":
      return "Open";
    case "PARTIALLY_FILLED":
      return "Partially Filled";
    case "FILLED":
      return "Filled";
    case "CANCELED":
      return "Canceled";
    case "REJECTED":
      return "Rejected";
    case "FAILED":
      return "Failed";
    case "EXPIRED":
      return "Expired";
    case "BROADCASTED":
      return "Broadcasted";
    case "CONFIRMING":
      return "Confirming";
    case "CONFIRMED":
      return "Confirmed";
    case "REVERTED":
      return "Reverted";
    case "SETTLED":
      return "Settled";
    default:
      return status;
  }
}
