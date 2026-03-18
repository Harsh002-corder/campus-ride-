import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RideHistoryTabs from "@/components/ride/RideHistoryTabs";

const ridesMyMock = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "student" } }),
}));

vi.mock("@/hooks/use-app-toast", () => ({
  useAppToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    rides: {
      my: () => ridesMyMock(),
      downloadInvoice: vi.fn(),
    },
  },
}));

describe("RideHistoryTabs", () => {
  beforeEach(() => {
    ridesMyMock.mockResolvedValue({
      rides: [
        {
          id: "507f1f77bcf86cd799439011",
          studentId: "s1",
          driverId: "d1",
          pickup: { lat: 1, lng: 1, label: "Hostel" },
          drop: { lat: 1.2, lng: 1.2, label: "Library" },
          status: "completed",
          verificationCode: "123456",
          cancelReason: null,
          cancelledBy: null,
          requestedAt: null,
          acceptedAt: null,
          ongoingAt: null,
          completedAt: null,
          cancelledAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  });

  it("opens ride details when a ride card is clicked", async () => {
    render(
      <MemoryRouter>
        <RideHistoryTabs />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Hostel/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Hostel/i }));

    expect(await screen.findByText(/Ride Details/i)).toBeInTheDocument();
    expect(screen.getByText(/507f1f77bcf86cd799439011/i)).toBeInTheDocument();
  });
});
