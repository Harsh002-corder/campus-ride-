import { getAuthToken } from "@/lib/apiClient";

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/$/, "");
const ensureApiSuffix = (value: string) => (/\/api\/?$/.test(value) ? value : `${value}/api`);
const API_BASE_URL = ensureApiSuffix(
  normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"),
);

async function getHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const mongoApi = {
  async find(collection: string, filter: Record<string, unknown> = {}, limit = 100) {
    const params = new URLSearchParams();
    if (Object.keys(filter).length) params.set("filter", JSON.stringify(filter));
    if (limit !== 100) params.set("limit", String(limit));
    const url = `${API_BASE_URL}/legacy/${collection}?${params}`;
    const res = await fetch(url, { headers: await getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async findOne(collection: string, filter: Record<string, unknown> = {}) {
    const res = await fetch(`${API_BASE_URL}/legacy/${collection}/findOne`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({ filter }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async insert(collection: string, data: Record<string, unknown> | Record<string, unknown>[]) {
    const res = await fetch(`${API_BASE_URL}/legacy/${collection}/insert`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async update(collection: string, filter: Record<string, unknown>, update: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/legacy/${collection}/update`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({ filter, update }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async remove(collection: string, filter: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/legacy/${collection}/delete`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({ filter }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
