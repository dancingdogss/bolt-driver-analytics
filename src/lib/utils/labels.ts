/**
 * Romanian display labels for the raw payment method values found in Bolt CSVs.
 * The raw values ("Bolt Payment", "Numerar", "Business") stay untouched in the
 * data layer — only the visible UI uses these labels.
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  "Bolt Payment": "Plată prin Bolt",
  Numerar: "Numerar",
  Business: "Business",
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}
