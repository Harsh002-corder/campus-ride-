const API_HOST_FALLBACK = "http://localhost:4000";

const normalizeBaseUrl = (value?: string) => (value || "").trim().replace(/\/$/, "");
const ensureApiSuffix = (value: string) => (/\/api\/?$/.test(value) ? value : `${value}/api`);

const socketBaseFromApiBase = (apiBase: string) => apiBase.replace(/\/api\/?$/, "");

export const API_BASE_URL = normalizeBaseUrl(
  ensureApiSuffix(normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || API_HOST_FALLBACK)),
);

export const SOCKET_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_SOCKET_BASE_URL || socketBaseFromApiBase(API_BASE_URL),
);
