import { fireEvent, render, screen } from "@testing-library/react";
import NewRideRequestPopup from "@/components/ride/NewRideRequestPopup";
import type { RideDto } from "@/lib/apiClient";

const baseRide: RideDto = {
  id: "ride-1",
  studentId: "student-123456",
  driverId: null,
  pickup: { lat: 12.9, lng: 77.5, label: "Library Gate" },
  drop: { lat: 12.91, lng: 77.51, label: "Hostel Block B" },
  status: "pending",
  verificationCode: "12",
  cancelReason: null,
  cancelledBy: null,
  requestedAt: new Date().toISOString(),
  acceptedAt: null,
  ongoingAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  student: { id: "student-123456", name: "Aarav" },
  passengers: 2,
};

describe("NewRideRequestPopup", () => {
  it("renders pickup, destination, student and passengers", () => {
    render(
      <NewRideRequestPopup
        ride={baseRide}
        busy={false}
        onAccept={() => {}}
        onIgnore={() => {}}
      />,
    );

    expect(screen.getByText("New Ride Request")).toBeInTheDocument();
    expect(screen.getByText("Aarav")).toBeInTheDocument();
    expect(screen.getByText(/Pickup:/)).toHaveTextContent("Pickup: Library Gate");
    expect(screen.getByText(/Destination:/)).toHaveTextContent("Destination: Hostel Block B");
    expect(screen.getByText(/2 passenger\(s\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Deny" }).length).toBeGreaterThan(0);
  });

  it("calls accept and ignore handlers", () => {
    const onAccept = vi.fn();
    const onIgnore = vi.fn();

    render(
      <NewRideRequestPopup
        ride={baseRide}
        busy={false}
        onAccept={onAccept}
        onIgnore={onIgnore}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Deny" })[0]);

    expect(onAccept).toHaveBeenCalledWith("ride-1");
    expect(onIgnore).toHaveBeenCalled();
  });
});
