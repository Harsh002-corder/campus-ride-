import { fireEvent, render, screen } from "@testing-library/react";
import IncomingRequestsList from "@/components/ride/IncomingRequestsList";
import type { RideDto } from "@/lib/apiClient";

const card = () => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 },
});

const makeRide = (id: string): RideDto => ({
  id,
  studentId: `student-${id}`,
  driverId: null,
  pickup: { lat: 12.9, lng: 77.5, label: "Main Gate" },
  drop: { lat: 12.91, lng: 77.52, label: "Science Block" },
  status: "requested",
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
  student: { id: `student-${id}`, name: `Student ${id}` },
  passengers: 1,
});

describe("IncomingRequestsList", () => {
  it("shows fallback text when there are no requests", () => {
    render(
      <IncomingRequestsList
        rides={[]}
        busy={false}
        card={card}
        onAccept={() => {}}
        onDecline={() => {}}
      />,
    );

    expect(screen.getByText("No incoming requests")).toBeInTheDocument();
  });

  it("renders incoming rides and action buttons", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const rides = [makeRide("1"), makeRide("2")];

    render(
      <IncomingRequestsList
        rides={rides}
        busy={false}
        card={card}
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );

    expect(screen.getByText("Student 1")).toBeInTheDocument();
    expect(screen.getByText("Student 2")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Accept Ride" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Ignore" })[1]);

    expect(onAccept).toHaveBeenCalledWith("1");
    expect(onDecline).toHaveBeenCalledWith("2");
  });
});
