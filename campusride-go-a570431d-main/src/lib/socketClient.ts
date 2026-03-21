import { io, type Socket } from "socket.io-client";
import { getAuthToken } from "@/lib/apiClient";
import { ENABLE_REALTIME, SOCKET_BASE_URL } from "@/lib/runtimeConfig";

let socket: Socket | null = null;

const forcePollingInProduction = import.meta.env.PROD;

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
      transports: forcePollingInProduction ? ["polling"] : ["websocket", "polling"],
      upgrade: !forcePollingInProduction,
      reconnection: true,
      reconnectionAttempts: forcePollingInProduction ? 5 : Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });
  }

  if (!ENABLE_REALTIME) {
    return socket;
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

export function disconnectSocketClient() {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
