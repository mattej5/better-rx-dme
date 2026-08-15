/**
 * A bundle is written one order per item in a single action (place-order.ts), so
 * five items become five rows that share a patient, a vendor, and an ordered_at.
 * Today renders one card per bundle; five identical cards read as five problems.
 */

export type BundleOrder = {
  orderId: string;
  patientId: string;
  vendorId: string | null;
  orderedAt: string;
};

export type OrderBundle<T extends BundleOrder> = {
  key: string;
  /** First order in caller-supplied order. Carries the shared status and badge. */
  lead: T;
  orders: T[];
  count: number;
  /** "1 item" / "5 items". */
  itemsLabel: string;
};

function minuteKey(orderedAt: string): string {
  const ms = Date.parse(orderedAt);
  return Number.isNaN(ms) ? orderedAt : String(Math.floor(ms / 60000));
}

export function bundleKey(order: BundleOrder): string {
  return [order.patientId, order.vendorId ?? "none", minuteKey(order.orderedAt)].join("|");
}

export function groupBundles<T extends BundleOrder>(orders: T[]): OrderBundle<T>[] {
  const groups = new Map<string, OrderBundle<T>>();
  for (const order of orders) {
    const key = bundleKey(order);
    const found = groups.get(key);
    if (found) {
      found.orders.push(order);
      found.count += 1;
      found.itemsLabel = `${found.count} items`;
      continue;
    }
    groups.set(key, { key, lead: order, orders: [order], count: 1, itemsLabel: "1 item" });
  }
  return [...groups.values()];
}
