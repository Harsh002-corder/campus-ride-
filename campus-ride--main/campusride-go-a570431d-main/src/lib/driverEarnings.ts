import type { DriverTodayEarningsDto, RideDto } from "@/lib/apiClient";

export function getTodayDateRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export function buildTodayEarningsFromRides(rides: RideDto[]): DriverTodayEarningsDto {
  const { start, end } = getTodayDateRange();

  const todayRides = rides
    .filter((ride) => ride.status === "completed")
    .filter((ride) => {
      const timestamp = ride.completedAt || ride.updatedAt || ride.createdAt;
      if (!timestamp) return false;
      const rideDate = new Date(timestamp);
      return rideDate >= start && rideDate < end;
    })
    .map((ride) => {
      const totalFare = Number(ride.fareBreakdown?.totalFare || 0);
      const platformFee = Number(ride.fareBreakdown?.platformFee || 0);
      const driverEarning = Number((totalFare - platformFee).toFixed(2));

      return {
        ...ride,
        rideTime: ride.completedAt || ride.updatedAt || ride.createdAt,
        totalFare: Number(totalFare.toFixed(2)),
        platformFee: Number(platformFee.toFixed(2)),
        driverEarning,
      };
    })
    .sort((firstRide, secondRide) => new Date(secondRide.rideTime || 0).getTime() - new Date(firstRide.rideTime || 0).getTime());

  const summary = todayRides.reduce((accumulator, ride) => ({
    totalEarnings: accumulator.totalEarnings + ride.totalFare,
    platformCharges: accumulator.platformCharges + ride.platformFee,
    netDriverEarnings: accumulator.netDriverEarnings + ride.driverEarning,
    completedRides: accumulator.completedRides + 1,
  }), {
    totalEarnings: 0,
    platformCharges: 0,
    netDriverEarnings: 0,
    completedRides: 0,
  });

  return {
    summary: {
      totalEarnings: Number(summary.totalEarnings.toFixed(2)),
      platformCharges: Number(summary.platformCharges.toFixed(2)),
      netDriverEarnings: Number(summary.netDriverEarnings.toFixed(2)),
      completedRides: summary.completedRides,
      currency: todayRides[0]?.fareBreakdown?.currency || "INR",
      date: start.toISOString(),
    },
    rides: todayRides,
  };
}