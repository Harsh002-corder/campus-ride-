import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/apiClient";

interface User {
  id?: string;
  name: string;
  email: string;
  role: "student" | "driver" | "admin";
  phone?: string | null;
  avatarUrl?: string | null;
  driverApprovalStatus?: "pending" | "approved" | "rejected";
  driverVerificationStatus?: "pending" | "approved" | "rejected";
  vehicleSeats?: number;
  driverPerformanceScore?: number;
  driverStats?: Record<string, unknown>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, authToken?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<User | null>(() => {
    if (!getAuthToken()) {
      return null;
    }

    const stored = localStorage.getItem("campusride_user");
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!token) {
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("campusride_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("campusride_user");
    }
  }, [user]);

  const login = (userData: User, authToken?: string) => {
    if (authToken) {
      setAuthToken(authToken);
      setToken(authToken);
    }
    setUser(userData);
  };

  const logout = () => {
    clearAuthToken();
    localStorage.removeItem("campusride_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user && !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
