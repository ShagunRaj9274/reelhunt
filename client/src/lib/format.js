export function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en');

export const formatCount = (n) => (n == null ? '' : compact.format(n));
export const formatMoney = (n) => (n ? usd.format(n) : null);
export const formatNumber = (n) => (n == null ? '' : full.format(n));

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
}
