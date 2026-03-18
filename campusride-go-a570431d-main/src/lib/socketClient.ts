import { io, type Socket } from "socket.io-client";
import { getAuthToken } from "@/lib/apiClient";
import { SOCKET_BASE_URL } from "@/lib/runtimeConfig";

let socket: Socket | null = null;

type SocketConnectErrorShape = {
  message?: string;
  code?: string;
  statusCode?: number;
  data?: {
    code?: string;
    statusCode?: number;
    message?: string;
  };
};

export function getSocketConnectErrorInfo(error: unknown) {
  const normalized = (error || {}) as SocketConnectErrorShape;
  const code = normalized.code || normalized.data?.code;
  const statusCode = normalized.statusCode || normalized.data?.statusCode;
  const rawMessage = normalized.message || normalized.data?.message || "";
  const isCorsForbidden = code === "SOCKET_CORS_FORBIDDEN"
    || statusCode === 403
    || /socket\s*cors\s*blocked|cors\s*blocked/i.test(rawMessage);

  const userMessage = isCorsForbidden
    ? "Realtime blocked by origin policy. Check backend ALLOWED_ORIGINS/ALLOWED_ORIGIN_PATTERNS."
    : "Realtime unavailable, using auto refresh";

  return {
    code,
    statusCode,
    rawMessage,
    isCorsForbidden,
    userMessage,
  };
}

export function getSocketConnectErrorMessage(error: unknown) {
  return getSocketConnectErrorInfo(error).userMessage;
}

export function getSocketClient(allowGuest = false) {
  if (!socket) {
    socket = io(SOCKET_BASE_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }

  const token = getAuthToken();
  if (token) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  } else if (allowGuest && !socket.connected) {
    socket.auth = {};
    socket.connect();
  }

  return socket;
}
