import type { DriverTodayEarningsDto, RideDto } from "@/lib/apiClient";

export interface DriverDailyEarningsEntry {
  date: string;
  totalEarnings: number;
  platformCharges: number;
  netDriverEarnings: number;
  completedRides: number;
}

export interface DriverDailyEarningsDto {
  summary: {
    totalEarnings: number;
    platformCharges: number;
    netDriverEarnings: number;
    completedRides: number;
    daysIncluded: number;
    currency: string;
    rangeStart: string;
    rangeEnd: string;
  };
  days: DriverDailyEarningsEntry[];
}

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

export function buildDailyEarningsFromRides(rides: RideDto[], days = 30): DriverDailyEarningsDto {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(0, days - 1));
  start.setHours(0, 0, 0, 0);

  const dailyMap = new Map<string, DriverDailyEarningsEntry>();
  let currency = "INR";

  rides
    .filter((ride) => ride.status === "completed")
    .forEach((ride) => {
      const timestamp = ride.completedAt || ride.updatedAt || ride.createdAt;
      if (!timestamp) return;

      const rideDate = new Date(timestamp);
      if (rideDate < start || rideDate > end) return;

      const dateKey = rideDate.toISOString().slice(0, 10);
      const totalFare = Number(ride.fareBreakdown?.totalFare || 0);
      const platformFee = Number(ride.fareBreakdown?.platformFee || 0);
      const driverEarning = Number((totalFare - platformFee).toFixed(2));

      if (ride.fareBreakdown?.currency) {
        currency = ride.fareBreakdown.currency;
      }

      const current = dailyMap.get(dateKey) || {
        date: dateKey,
        totalEarnings: 0,
        platformCharges: 0,
        netDriverEarnings: 0,
        completedRides: 0,
      };

      current.totalEarnings += totalFare;
      current.platformCharges += platformFee;
      current.netDriverEarnings += driverEarning;
      current.completedRides += 1;

      dailyMap.set(dateKey, current);
    });

  const entries = Array.from(dailyMap.values())
    .map((entry) => ({
      ...entry,
      totalEarnings: Number(entry.totalEarnings.toFixed(2)),
      platformCharges: Number(entry.platformCharges.toFixed(2)),
      netDriverEarnings: Number(entry.netDriverEarnings.toFixed(2)),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const summary = entries.reduce((accumulator, entry) => ({
    totalEarnings: accumulator.totalEarnings + entry.totalEarnings,
    platformCharges: accumulator.platformCharges + entry.platformCharges,
    netDriverEarnings: accumulator.netDriverEarnings + entry.netDriverEarnings,
    completedRides: accumulator.completedRides + entry.completedRides,
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
      daysIncluded: Math.max(1, days),
      currency,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
    },
    days: entries,
  };
}