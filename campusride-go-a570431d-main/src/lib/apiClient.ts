import { API_BASE_URL } from "@/config/api";

export type UserRole = "student" | "driver" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  isOnline?: boolean;
  isActive?: boolean;
  driverApprovalStatus?: "pending" | "approved" | "rejected";
  driverVerificationStatus?: "pending" | "approved" | "rejected";
  vehicleSeats?: number;
  driverPerformanceScore?: number;
  driverStats?: Record<string, unknown>;
}

export interface RidePayload {
  pickup: { lat: number; lng: number; label?: string };
  drop: { lat: number; lng: number; label?: string };
  studentGps?: { lat: number; lng: number; accuracy?: number };
  passengers?: number;
  passengerNames?: string[];
  scheduledAt?: string;
  splitFare?: boolean;
}

export interface FavoriteLocation {
  id: string;
  label: string;
  location: { lat: number; lng: number; address?: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface RideDto {
  id: string;
  studentId: string | null;
  driverId: string | null;
  student?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  driver?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  pickup: { lat: number; lng: number; label?: string };
  drop: { lat: number; lng: number; label?: string };
  passengers?: number;
  status: "scheduled" | "pending" | "accepted" | "in_progress" | "completed" | "cancelled" | "requested" | "ongoing";
  timeline?: Array<{ key: string; label: string; reached: boolean; timestamp?: string | null }>;
  verificationCode: string;
  passengerNames?: string[];
  isGroupRide?: boolean;
  studentRating?: number | null;
  studentFeedback?: string;
  feedbackAt?: string | null;
  smartMatch?: {
    bestDriver?: {
      driverId: string;
      name: string;
      phone?: string | null;
      distanceKm: number;
      rating: number;
      seatsAvailable: number;
    } | null;
    candidates?: Array<unknown>;
    totalCandidates?: number;
  } | null;
  fareBreakdown?: {
    currency: string;
    baseFare: number;
    distanceKm: number;
    estimatedDurationMinutes: number;
    distanceCharge: number;
    timeCharge: number;
    surgeMultiplier: number;
    subtotal: number;
    platformFeePercent?: number;
    platformFee?: number;
    totalFare: number;
    perPassengerFare?: number;
    generatedAt: string;
  } | null;
  cancelReason: string | null;
  cancellationReasonKey?: string | null;
  cancellationCustomReason?: string | null;
  cancelledBy: string | null;
  driverLocation?: { lat: number; lng: number; updatedAt?: string } | null;
  studentLocation?: { lat: number; lng: number; updatedAt?: string } | null;
  etaMinutes?: number | null;
  etaDistanceKm?: number | null;
  isDelayed?: boolean;
  delayReason?: string | null;
  timingCalculatedAt?: string | null;
  shareTrackingUrl?: string | null;
  sharedLinkExpiresAt?: string | null;
  sharedLinkToken?: string | null;
  requestedAt: string | null;
  acceptedAt: string | null;
  ongoingAt: string | null;
  completedAt: string | null;
  scheduledFor?: string | null;
  scheduleActivatedAt?: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RideIssueDto {
  id: string;
  ride?: {
    id: string;
    pickup?: { label?: string } | null;
    drop?: { label?: string } | null;
    status?: string | null;
    createdAt?: string | null;
  } | null;
  reporter?: { id: string; name?: string | null; email?: string | null; role?: string | null } | null;
  reporterRole?: string | null;
  category: "overcharge" | "driver_behavior" | "route_issue" | "safety" | "app_issue" | "other";
  description: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  resolutionNote?: string;
  assignedAdmin?: { id: string; name?: string | null; email?: string | null } | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const TOKEN_KEY = "campusride_token";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const fieldErrors = payload?.details?.fieldErrors as Record<string, string[]> | undefined;
    const firstFieldError = fieldErrors
      ? Object.values(fieldErrors).flat().find((message) => typeof message === "string" && message.length > 0)
      : undefined;
    throw new Error(firstFieldError || payload.error || "Request failed");
  }

  return payload as T;
}

async function requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error("Request failed");
  }

  return response.blob();
}

export const apiClient = {
  auth: {
    requestSignupOtp(input: {
      name: string;
      email: string;
      password: string;
      role: Extract<UserRole, "student" | "driver">;
      phone?: string;
      driverSecurity?: {
        licenseNumber: string;
        vehicleNumber: string;
        emergencyContactName: string;
        emergencyContactPhone: string;
        idNumberLast4: string;
      };
    }) {
      return request<{ message: string; email: string; expiresAt: string; otp?: string }>("/auth/request-signup-otp", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    verifySignupOtp(input: {
      email: string;
      role: Extract<UserRole, "student" | "driver">;
      otp: string;
    }) {
      return request<{ token?: string; user?: AuthUser; message?: string }>("/auth/verify-signup-otp", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    login(input: { email: string; password: string }) {
      return request<{ token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    forgotPassword(input: { email: string }) {
      return request<{ message: string; email: string; expiresAt?: string; otp?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    resetPassword(input: { email: string; otp: string; newPassword: string }) {
      return request<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    me() {
      return request<{ user: AuthUser }>("/auth/me");
    },
  },
  rides: {
    book(input: RidePayload) {
      return request<{ ride: RideDto }>("/rides", { method: "POST", body: JSON.stringify(input) });
    },
    my() {
      return request<{ rides: RideDto[] }>("/rides/my");
    },
    history() {
      return request<{ rides: RideDto[] }>("/rides/history");
    },
    get(rideId: string) {
      return request<{ ride: RideDto }>(`/rides/${rideId}`);
    },
    downloadInvoice(rideId: string) {
      return requestBlob(`/rides/${rideId}/invoice`);
    },
    fareEstimate(input: { pickup: { lat: number; lng: number; label?: string }; drop: { lat: number; lng: number; label?: string } }) {
      return request<{ fare: RideDto["fareBreakdown"] }>("/rides/fare-estimate", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    available() {
      return request<{ rides: RideDto[] }>("/rides/available");
    },
    accept(rideId: string) {
      return request(`/rides/${rideId}/accept`, { method: "POST" });
    },
    reject(rideId: string) {
      return request(`/rides/${rideId}/reject`, { method: "POST" });
    },
    deny(rideId: string) {
      return request(`/rides/${rideId}/deny`, { method: "POST" });
    },
    start(rideId: string) {
      return request(`/rides/${rideId}/start`, { method: "POST" });
    },
    verify(rideId: string, code: string) {
      return request(`/rides/${rideId}/verify`, { method: "POST", body: JSON.stringify({ code }) });
    },
    complete(rideId: string) {
      return request(`/rides/${rideId}/complete`, { method: "POST" });
    },
    feedback(rideId: string, rating: number, message?: string) {
      return request<{ ride: RideDto }>(`/rides/${rideId}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating, message: message || "" }),
      });
    },
    cancel(rideId: string, input: { reason?: string; reasonKey?: string; customReason?: string }) {
      return request(`/rides/${rideId}/cancel`, { method: "POST", body: JSON.stringify(input) });
    },
    updateLocation(rideId: string, lat: number, lng: number) {
      return request(`/rides/${rideId}/location`, { method: "POST", body: JSON.stringify({ lat, lng }) });
    },
  },
  public: {
    tracking(token: string, otp: string) {
      const safeOtp = encodeURIComponent(otp.trim());
      return request<{ ride: RideDto; socketRoom: string }>(`/public/rides/${token}?otp=${safeOtp}`);
    },
  },
  users: {
    me() {
      return request("/users/me");
    },
    list(role?: UserRole) {
      const query = role ? `?role=${role}` : "";
      return request(`/users${query}`);
    },
    updateMyProfile(input: { name?: string; phone?: string | null; avatarUrl?: string | null }) {
      return request<{ user: AuthUser }>("/users/me", { method: "PATCH", body: JSON.stringify(input) });
    },
    favorites() {
      return request<{ favorites: FavoriteLocation[] }>("/users/me/favorites");
    },
    addFavorite(input: { label: string; location: { lat: number; lng: number; address?: string } }) {
      return request<{ favorite: FavoriteLocation }>("/users/me/favorites", { method: "POST", body: JSON.stringify(input) });
    },
    deleteFavorite(favoriteId: string) {
      return request(`/users/me/favorites/${favoriteId}`, { method: "DELETE" });
    },
  },
  drivers: {
    online() {
      return request("/drivers/online");
    },
    setOnline(online: boolean) {
      return request("/drivers/me/online", { method: "PATCH", body: JSON.stringify({ online }) });
    },
    setLocation(lat: number, lng: number) {
      return request("/drivers/me/location", { method: "PATCH", body: JSON.stringify({ lat, lng }) });
    },
    verification() {
      return request<{ verification: { id: string; status: "pending" | "approved" | "rejected"; reviewNotes: string; documents: Array<{ type: string; url: string; fileName: string; uploadedAt: string }> } | null }>("/drivers/me/verification");
    },
    uploadVerification(input: { docType: "license" | "id_proof" | "vehicle_rc"; fileDataUrl: string; fileName?: string }) {
      return request("/drivers/me/verification", { method: "POST", body: JSON.stringify(input) });
    },
  },
  admin: {
    analytics() {
      return request<{
        metrics: {
          totalUsers: number;
          totalStudents: number;
          totalDrivers: number;
          pendingDrivers: number;
          totalRides: number;
          requestedRides: number;
          acceptedRides: number;
          ongoingRides: number;
          completedRides: number;
          cancelledRides: number;
          cancellationRate: number;
          totalRevenue: number;
          averageFare: number;
        };
        cancellations: Array<{ id: string; cancelReason: string | null; cancelledBy: string | null; cancelledAt: string | null }>;
        bookingTrend: Array<{ day: string; count: number }>;
        peakBookingHours: Array<{ hour: number; bookings: number }>;
        driverPerformance: Array<{ driverId: string | null; driverName: string; completedRides: number; avgRating: number; revenue: number }>;
        cancellationReasons?: Array<{ reasonKey: string; count: number }>;
      }>("/admin/analytics");
    },
    rides(filters?: { status?: string; driverId?: string; reasonKey?: string; from?: string; to?: string }) {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.driverId) params.set("driverId", filters.driverId);
      if (filters?.reasonKey) params.set("reasonKey", filters.reasonKey);
      if (filters?.from) params.set("from", filters.from);
      if (filters?.to) params.set("to", filters.to);
      const query = params.toString();
      return request<{ rides: RideDto[] }>(`/admin/rides${query ? `?${query}` : ""}`);
    },
    verifications() {
      return request<{ verifications: Array<{ id: string; driverId: string | null; status: "pending" | "approved" | "rejected"; reviewNotes: string; documents: Array<{ type: string; url: string; fileName: string; uploadedAt: string }> }> }>("/admin/verifications");
    },
    scheduledRides() {
      return request<{
        queue: Array<{
          id: string;
          status: "pending" | "activated" | "cancelled" | "failed";
          triggerAt: string;
          rideId: string | null;
          rideStatus: string | null;
          pickup?: { label?: string } | null;
          drop?: { label?: string } | null;
          passengers: number;
          student?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
          lastAttemptAt?: string | null;
          errorMessage?: string | null;
          createdAt?: string;
          updatedAt?: string;
        }>;
      }>("/admin/scheduled-rides");
    },
    issues(filters?: { status?: string; category?: string; search?: string }) {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.category) params.set("category", filters.category);
      if (filters?.search) params.set("search", filters.search);
      const query = params.toString();
      return request<{ issues: RideIssueDto[] }>(`/admin/issues${query ? `?${query}` : ""}`);
    },
    updateIssue(issueId: string, input: { status: "in_review" | "resolved" | "rejected"; resolutionNote?: string }) {
      return request<{ issue: RideIssueDto }>(`/admin/issues/${issueId}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    reviewVerification(verificationId: string, input: { status: "approved" | "rejected"; reviewNotes?: string }) {
      return request(`/admin/verifications/${verificationId}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    updateUser(userId: string, input: Record<string, unknown>) {
      return request(`/users/${userId}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    deleteUser(userId: string) {
      return request(`/users/${userId}`, { method: "DELETE" });
    },
  },
  settings: {
    list() {
      return request("/settings");
    },
    update(input: { key: string; value: unknown; description?: string }) {
      return request("/settings", { method: "PUT", body: JSON.stringify(input) });
    },
  },
  stops: {
    suggest(query: string, limit = 8) {
      return request<{ suggestions: Array<{ name: string; lat: number; lng: number }> }>(
        `/stops/suggest?q=${encodeURIComponent(query)}&limit=${limit}`,
      );
    },
  },
  notifications: {
    my() {
      return request<{ notifications: Array<{ id: string; title: string; body: string; type: string; readAt: string | null; createdAt: string }> }>("/notifications/my");
    },
    markRead(notificationId: string) {
      return request(`/notifications/${notificationId}/read`, { method: "PATCH" });
    },
  },
  issues: {
    my() {
      return request<{ issues: RideIssueDto[] }>("/issues/my");
    },
    create(input: { rideId: string; category: RideIssueDto["category"]; description: string }) {
      return request<{ issue: RideIssueDto }>("/issues", { method: "POST", body: JSON.stringify(input) });
    },
  },
  chatbot: {
    message(message: string) {
      return request<{ assistant: string; intent: { type: string }; data?: Record<string, unknown> }>("/chatbot/message", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
    },
  },
};
