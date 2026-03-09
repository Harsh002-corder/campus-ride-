import { CAMPUS_STOPS } from "@/lib/stops";

type LatLng = { lat: number; lng: number };

function cross(origin: LatLng, pointA: LatLng, pointB: LatLng) {
  return (pointA.lat - origin.lat) * (pointB.lng - origin.lng)
    - (pointA.lng - origin.lng) * (pointB.lat - origin.lat);
}

function computeConvexHull(points: LatLng[]) {
  const unique = Array.from(
    new Map(points.map((point) => [`${point.lat.toFixed(6)}:${point.lng.toFixed(6)}`, point])).values(),
  );

  if (unique.length <= 3) {
    return unique;
  }

  const sorted = [...unique].sort((left, right) => (left.lat - right.lat) || (left.lng - right.lng));

  const lower: LatLng[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: LatLng[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function computeCenter(points: LatLng[]) {
  if (!points.length) {
    return { lat: 28.8244, lng: 78.6579 };
  }

  const aggregate = points.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: Number((aggregate.lat / points.length).toFixed(6)),
    lng: Number((aggregate.lng / points.length).toFixed(6)),
  };
}

const stopPoints: LatLng[] = CAMPUS_STOPS.map((stop) => ({ lat: stop.lat, lng: stop.lng }));

export const CAMPUS_BOUNDARY_POLYGON = computeConvexHull(stopPoints);

export const CAMPUS_MAP_CENTER = computeCenter(stopPoints);

export function pointInPolygon(point: { lat: number; lng: number }, polygon = CAMPUS_BOUNDARY_POLYGON) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;

    const intersect = ((yi > point.lng) !== (yj > point.lng))
      && (point.lat < ((xj - xi) * (point.lng - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

export function isWithinCampusBoundary(point: { lat: number; lng: number }) {
  return pointInPolygon(point, CAMPUS_BOUNDARY_POLYGON);
}
