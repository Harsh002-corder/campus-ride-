import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { TMU_CAMPUS_CENTER, TMU_LOCATIONS, type CampusLocation } from "@/lib/tmuLocations";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function FitMarkersBounds({ locations }: { locations: CampusLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (!locations.length) {
      map.setView(TMU_CAMPUS_CENTER, 16);
      return;
    }

    const bounds = L.latLngBounds(locations.map((location) => [location.lat, location.lng]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [locations, map]);

  return null;
}

type TMUCampusMapProps = {
  locations?: CampusLocation[];
};

export default function TMUCampusMap({ locations = TMU_LOCATIONS }: TMUCampusMapProps) {
  const markerData = useMemo(() => locations, [locations]);
  const mapContainerProps = {
    center: TMU_CAMPUS_CENTER,
    zoom: 16,
    className: "h-full w-full",
  } as unknown as React.ComponentProps<typeof MapContainer>;
  const tileLayerProps = {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  } as unknown as React.ComponentProps<typeof TileLayer>;

  return (
    <div className="h-[70vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <MapContainer {...mapContainerProps}>
        <TileLayer {...tileLayerProps} />
        <FitMarkersBounds locations={markerData} />

        {markerData.map((location) => (
          <Marker key={location.name} position={[location.lat, location.lng]}>
            <Popup>{location.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
