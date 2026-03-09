import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngTuple, LeafletMouseEvent } from "leaflet";
import { CAMPUS_BOUNDARY_POLYGON, CAMPUS_MAP_CENTER, TMU_MAIN_GATE, isInsideCampus } from "@/lib/campusBoundary";

type SelectedPoint = { lat: number; lng: number; label: string } | null;

type Props = {
  pickupPoint: SelectedPoint;
  dropPoint: SelectedPoint;
  selectionTarget: "pickup" | "drop";
  onSelectPoint: (point: { lat: number; lng: number }, target: "pickup" | "drop") => void;
  onOutsideBoundary: () => void;
};

const polygonPath: LatLngTuple[] = CAMPUS_BOUNDARY_POLYGON.map((point) => [point.lat, point.lng]);

function FitToCampusPolygon() {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(polygonPath);
  }, [map]);

  return null;
}

function ClickHandler({
  selectionTarget,
  onSelectPoint,
  onOutsideBoundary,
}: {
  selectionTarget: "pickup" | "drop";
  onSelectPoint: (point: { lat: number; lng: number }, target: "pickup" | "drop") => void;
  onOutsideBoundary: () => void;
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      const { lat, lng } = event.latlng;
      if (!isInsideCampus(lat, lng)) {
        onOutsideBoundary();
        return;
      }
      onSelectPoint({ lat, lng }, selectionTarget);
    },
  });

  return null;
}

export default function TMUCampusLeafletMap({
  pickupPoint,
  dropPoint,
  selectionTarget,
  onSelectPoint,
  onOutsideBoundary,
}: Props) {
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

      <FitToCampusPolygon />
      <ClickHandler
        selectionTarget={selectionTarget}
        onSelectPoint={onSelectPoint}
        onOutsideBoundary={onOutsideBoundary}
      />

      <Polygon
        positions={polygonPath}
        pathOptions={{
          color: "#16a34a",
          weight: 3,
          fillColor: "#22c55e",
          fillOpacity: 0.18,
        }}
      />

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
