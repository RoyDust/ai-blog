export type DeliveryStats = { total: number; sent: number; failed: number; pending: number; sending: number; skipped: number; unknown: number };

export function buildDeliveryStats(deliveries: Array<{ status: string }>): DeliveryStats {
  const stats: DeliveryStats = { total: deliveries.length, sent: 0, failed: 0, pending: 0, sending: 0, skipped: 0, unknown: 0 };
  for (const { status } of deliveries) {
    if (status === 'sent' || status === 'failed' || status === 'pending' || status === 'sending' || status === 'skipped') stats[status]++;
    else stats.unknown++;
  }
  return stats;
}
