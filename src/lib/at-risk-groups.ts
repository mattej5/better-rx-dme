/**
 * One banner per reason, not one per order. Evelyn Brooks carries three orders
 * flagged by the same rule; three near-identical red banners read as three
 * separate emergencies.
 */

export type AtRiskItem = {
  orderId: string;
  reason: string;
  /**
   * The rule that raised the flag. Two orders flagged by the same rule read as
   * one problem even though their reasons differ in the minutes and the clock
   * time they quote, so the rule groups them when it is known.
   */
  rule?: string | null;
};

export type AtRiskGroup = {
  /** Rule name where one exists, otherwise the reason itself. */
  key: string;
  /** The first reason in the group, unchanged. */
  reason: string;
  /** Worst-first is caller-supplied ordering; this is the first order in that order. */
  orderId: string;
  count: number;
  /** What the banner actually says. */
  label: string;
};

export function groupAtRisk(items: AtRiskItem[]): AtRiskGroup[] {
  const byReason = new Map<string, AtRiskGroup>();
  for (const item of items) {
    const key = item.rule ?? item.reason;
    const found = byReason.get(key);
    if (found) {
      found.count += 1;
      found.label = `${found.count} orders: ${found.reason}`;
      continue;
    }
    byReason.set(key, {
      key,
      reason: item.reason,
      orderId: item.orderId,
      count: 1,
      label: item.reason,
    });
  }
  return [...byReason.values()];
}
