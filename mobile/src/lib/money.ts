const INR = 'INR';

export function parseMajorToMinor(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const minorFraction = (fraction + '00').slice(0, 2);
  const minor = Number(whole) * 100 + Number(minorFraction);
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    return null;
  }
  return minor;
}

export function formatMinor(amountMinor: number, currency = INR): string {
  const major = Math.trunc(amountMinor / 100);
  const fraction = Math.abs(amountMinor % 100);
  const fractionText = String(fraction).padStart(2, '0');
  if (currency === INR) {
    return `₹${major.toLocaleString('en-IN')}.${fractionText}`;
  }
  return `${currency} ${major}.${fractionText}`;
}

export function netBalanceLabel(netMinor: number, viewerId: string, userId: string): string {
  if (userId !== viewerId) {
    return formatMinor(Math.abs(netMinor));
  }
  if (netMinor > 0) {
    return `You are owed ${formatMinor(netMinor)}`;
  }
  if (netMinor < 0) {
    return `You owe ${formatMinor(-netMinor)}`;
  }
  return 'Settled';
}

export function categoryLabel(category: string): string {
  switch (category) {
    case 'food':
      return 'Food';
    case 'transport':
      return 'Transport';
    case 'lodging':
      return 'Lodging';
    case 'activities':
      return 'Activities';
    case 'shopping':
      return 'Shopping';
    default:
      return 'Other';
  }
}
