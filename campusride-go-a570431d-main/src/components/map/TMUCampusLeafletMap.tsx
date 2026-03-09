import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { CAMPUS_MAP_CENTER, TMU_MAIN_GATE } from "@/lib/campusBoundary";

type SelectedPoint = { lat: number; lng: number; label: string } | null;

type Props = {
  pickupPoint: SelectedPoint;
  dropPoint: SelectedPoint;
  selectionTarget: "pickup" | "drop";
  onSelectPoint: (point: { lat: number; lng: number }, target: "pickup" | "drop") => void;
};

function getSelectionBoundary(pickupPoint: SelectedPoint, dropPoint: SelectedPoint): [number, number][] | null {
  const points = [pickupPoint, dropPoint].filter((point): point is NonNullable<SelectedPoint> => Boolean(point));
  if (points.length === 0) return null;

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  // Keep a visible boundary even when only one point is selected.
  const latPadding = Math.max(0.0004, (maxLat - minLat) * 0.2);
  const lngPadding = Math.max(0.0004, (maxLng - minLng) * 0.2);

  return [
    [minLat - latPadding, minLng - lngPadding],
    [minLat - latPadding, maxLng + lngPadding],
    [maxLat + latPadding, maxLng + lngPadding],
    [maxLat + latPadding, minLng - lngPadding],
  ];
}

function ClickHandler({
  selectionTarget,
  onSelectPoint,
}: {
  selectionTarget: "pickup" | "drop";
  onSelectPoint: (point: { lat: number; lng: number }, target: "pickup" | "drop") => void;
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      const { lat, lng } = event.latlng;
      // Campus boundary checks are temporarily disabled for unrestricted map selection.
      onSelectPoint({ lat, lng }, selectionTarget);
    },
  });

  return null;
}

function FitToSelectionBoundary({ boundary }: { boundary: [number, number][] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!boundary || boundary.length < 3) return;
    map.fitBounds(boundary, { padding: [18, 18] });
  }, [map, boundary]);

  return null;
}

export default function TMUCampusLeafletMap({
  pickupPoint,
  dropPoint,
  selectionTarget,
  onSelectPoint,
}: Props) {
  const selectionBoundary = getSelectionBoundary(pickupPoint, dropPoint);

  return (
    <MapContainer
      center={[CAMPUS_MAP_CENTER.lat, CAMPUS_MAP_CENTER.lng]}
      zoom={16}
      className="w-full h-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler
        selectionTarget={selectionTarget}
        onSelectPoint={onSelectPoint}
      />
      <FitToSelectionBoundary boundary={selectionBoundary} />

      {selectionBoundary && (
        <Polygon
          positions={selectionBoundary}
          pathOptions={{
            color: "#f97316",
            weight: 2,
            fillColor: "#fb923c",
            fillOpacity: 0.08,
            dashArray: "6 6",
          }}
        />
      )}

      <Marker position={[TMU_MAIN_GATE.lat, TMU_MAIN_GATE.lng]}>
        <Popup>TMU Main Gate</Popup>
      </Marker>

      {pickupPoint && (
        <CircleMarker
          center={[pickupPoint.lat, pickupPoint.lng]}
          radius={8}
          pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.8 }}
        >
          <Popup>Pickup: {pickupPoint.label}</Popup>
        </CircleMarker>
      )}

      {dropPoint && (
        <CircleMarker
          center={[dropPoint.lat, dropPoint.lng]}
          radius={8}
          pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.8 }}
        >
          <Popup>Drop: {dropPoint.label}</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
