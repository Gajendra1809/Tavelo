const BOOKING_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Normalize Android/iOS picker MIME strings before upload-intent. */
export function normalizeBookingMime(mimeType: string | null | undefined, filename: string): string {
  const lower = (mimeType ?? '').toLowerCase().trim();
  if (lower === 'image/jpg') {
    return 'image/jpeg';
  }
  if (BOOKING_MIMES.has(lower)) {
    return lower;
  }
  const name = filename.toLowerCase();
  if (name.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (name.endsWith('.png')) {
    return 'image/png';
  }
  if (name.endsWith('.webp')) {
    return 'image/webp';
  }
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return lower;
}

export function isAllowedBookingMime(mimeType: string): boolean {
  return BOOKING_MIMES.has(normalizeBookingMime(mimeType, ''));
}
