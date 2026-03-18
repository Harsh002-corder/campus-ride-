import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";

const notificationsMyMock = vi.fn();
const notificationsMarkReadMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    notifications: {
      my: () => notificationsMyMock(),
      markRead: (...args: unknown[]) => notificationsMarkReadMock(...args),
    },
  },
}));

vi.mock("@/lib/socketClient", () => ({
  getSocketClient: () => ({ on: vi.fn(), off: vi.fn() }),
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    notificationsMyMock.mockResolvedValue({
      notifications: [
        {
          id: "n1",
          title: "Ride Updated",
          body: "Ride 507f1f77bcf86cd799439011 is now accepted",
          type: "ride",
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    notificationsMarkReadMock.mockResolvedValue({ ok: true });
  });

  it("marks read and navigates to ride details from notification", async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    const trigger = await screen.findByRole("button");
    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByText(/Ride Updated/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Ride Updated/i));

    await waitFor(() => {
      expect(notificationsMarkReadMock).toHaveBeenCalledWith("n1");
      expect(navigateMock).toHaveBeenCalledWith("/rides/507f1f77bcf86cd799439011");
    });
  });
});
