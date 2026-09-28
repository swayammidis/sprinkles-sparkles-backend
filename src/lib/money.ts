/**
 * Money helpers. Amounts are stored as integer paise (₹1 = 100 paise), so all
 * arithmetic and comparisons are exact. Never use floating point for money.
 * Shared by the browser (forms) and the server.
 */

/** "180", "180.5", "180.50" → valid; anything else → invalid. */
export const RUPEES_REGEX = /^\d{1,7}(\.\d{1,2})?$/;

/** Parse a rupee string into paise without floating point. Returns null if invalid. */
export function rupeesToPaise(input: string): number | null {
  const s = input.trim();
  if (!RUPEES_REGEX.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number.parseInt(whole, 10) * 100 + Number.parseInt((frac + "00").slice(0, 2), 10);
}

/** 18050 → "180.50" */
export function paiseToRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** 18050 → "180.5" style for form inputs (drops trailing ".00"). */
export function paiseToInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  const s = paiseToRupees(paise);
  return s.endsWith(".00") ? s.slice(0, -3) : s;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Display only: 18000 → "₹180", 18050 → "₹180.50". */
export function formatPaise(paise: number | null | undefined): string {
  if (paise == null) return "—";
  const rupees = paise / 100;
  return paise % 100 === 0 ? inr.format(rupees) : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(rupees);
}
