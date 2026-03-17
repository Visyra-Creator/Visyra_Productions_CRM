import Constants from 'expo-constants';

type ExpoExtra = {
  EXPO_PUBLIC_BACKEND_URL?: string;
};

const DEFAULT_BACKEND_BASE_URL = 'http://192.168.1.10:8000';

function readExpoExtra(): ExpoExtra {
  return (
    (Constants.expoConfig?.extra as ExpoExtra | undefined) ??
    ((Constants as any).manifest2?.extra as ExpoExtra | undefined) ??
    {}
  );
}

export function getBackendBaseUrl(): string {
  const extra = readExpoExtra();
  const rawBaseUrl = String(extra.EXPO_PUBLIC_BACKEND_URL ?? '').trim();

  if (!rawBaseUrl) {
    console.warn('[config] EXPO_PUBLIC_BACKEND_URL is missing. Falling back to local network URL.');
    return DEFAULT_BACKEND_BASE_URL;
  }

  if (rawBaseUrl.includes('localhost') || rawBaseUrl.includes('127.0.0.1')) {
    console.warn('[config] EXPO_PUBLIC_BACKEND_URL points to localhost. Falling back to local network URL.');
    return DEFAULT_BACKEND_BASE_URL;
  }

  return rawBaseUrl;
}

export function getBackendApiBaseUrl(): string {
  return `${getBackendBaseUrl()}/api`;
}

