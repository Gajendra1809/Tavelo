export type ApiConfig = {
  baseUrl: string;
};

export type ApiConfigResult = ApiConfig | { error: string };

const CONFIG_HELP =
  'Set EXPO_PUBLIC_API_URL in mobile/.env, then restart Expo. On a phone, use your computer’s LAN IP instead of localhost.';

export function readApiConfig(): ApiConfigResult {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) {
    return { error: CONFIG_HELP };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: `EXPO_PUBLIC_API_URL is not a valid URL. ${CONFIG_HELP}` };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'EXPO_PUBLIC_API_URL must start with http:// or https://.' };
  }

  return { baseUrl: raw.replace(/\/$/, '') };
}

export function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

/** PC on phone USB/Wi‑Fi hotspot (e.g. 172.26.x) — the phone usually cannot reach the PC at that IP. */
export function isTetheredPcLanUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
      return true;
    }
    return hostname.startsWith('192.168.43.');
  } catch {
    return false;
  }
}
