const DEFAULT_API_URL = import.meta.env.PROD
  ? "https://campusride-backend.onrender.com"
  : "http://localhost:4000";

const normalizeBaseUrl = (value?: string) => (value || "").trim().replace(/\/$/, "");
const ensureApiSuffix = (value: string) => (/\/api\/?$/.test(value) ? value : `${value}/api`);

export const API_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL || DEFAULT_API_URL);
export const API_BASE_URL = normalizeBaseUrl(ensureApiSuffix(API_URL));
export const SOCKET_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_SOCKET_BASE_URL || API_URL);
