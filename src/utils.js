export const DAY_MS = 24 * 60 * 60 * 1000;

export const today = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const addDays = (dateString, days) => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const formatDate = (dateString) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString));

export const formatMonthDay = (dateString) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateString));

export const compareDateStrings = (a, b) => new Date(a).getTime() - new Date(b).getTime();

export const daysUntil = (dateString) => Math.floor((new Date(dateString).getTime() - new Date(today()).getTime()) / DAY_MS);

export const dueLabel = (dateString) => {
  const diff = daysUntil(dateString);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff}d`;
};

export const startOfMonthGrid = (anchorDate) => {
  const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - offset);
  return first;
};

export const dateRange = (startDate, count) =>
  Array.from({ length: count }, (_, index) => {
    const current = new Date(startDate);
    current.setDate(current.getDate() + index);
    const local = new Date(current.getTime() - current.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });

export const randomId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
