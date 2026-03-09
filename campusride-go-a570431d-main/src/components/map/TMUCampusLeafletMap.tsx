import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { CAMPUS_MAP_CENTER, TMU_MAIN_GATE } from "@/lib/campusBoundary";

type SelectedPoint = { lat: number; lng: number; label: string } | null;

type Props = {
  pickupPoint: SelectedPoint;
  dropPoint: SelectedPoint;
  selectionTarget: "pickup" | "drop";
  onSelectPoint: (point: { lat: number; lng: number }, target: "pickup" | "drop") => void;
};

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

export default function TMUCampusLeafletMap({
  pickupPoint,
  dropPoint,
  selectionTarget,
  onSelectPoint,
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
      <ClickHandler
        selectionTarget={selectionTarget}
        onSelectPoint={onSelectPoint}
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
