const PRICE_MATCH_EPSILON = 0.05;

export function formatMt5DateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatLedgerPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '';
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 100 ? 2 : 5,
  });
}

export function formatLedgerMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '0.00';
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatLedgerVolume(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '';
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pricesMatch(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) {
    return false;
  }
  return Math.abs(a - b) <= PRICE_MATCH_EPSILON;
}
