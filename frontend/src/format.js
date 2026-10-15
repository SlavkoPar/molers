export const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

export const formatDuration = (seconds) => {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
};

export const formatPrice = (cents) => (cents == null ? "" : (cents / 100).toFixed(2));
