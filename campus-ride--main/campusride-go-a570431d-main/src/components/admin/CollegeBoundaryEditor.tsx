import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";

type BoundaryPoint = { lat: number; lng: number };

interface CollegeBoundaryEditorProps {
  points: BoundaryPoint[];
  onChange: (points: BoundaryPoint[]) => void;
  heightClassName?: string;
}

const SNAP_DISTANCE_METERS = 20;

const vertexIcon = L.divIcon({
  className: "",
  html: '<span style="display:block;width:12px;height:12px;border-radius:9999px;background:#2563eb;border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(37,99,235,0.35)"></span>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function toClosedPolygon(points: BoundaryPoint[]) {
  if (!Array.isArray(points) || points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) return points;
  return [...points, { ...first }];
}

function centroid(points: BoundaryPoint[]) {
  if (!Array.isArray(points) || points.length === 0) {
    return { lat: 28.8386, lng: 78.7567 };
  }
  const sum = points.reduce((acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

function distanceMeters(from: BoundaryPoint, to: BoundaryPoint) {
  const earthRadiusM = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computePolygonAreaMeters(points: BoundaryPoint[]) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  const center = centroid(points);
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((center.lat * Math.PI) / 180);

  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = (points[i].lng - center.lng) * metersPerDegreeLng;
    const yi = (points[i].lat - center.lat) * metersPerDegreeLat;
    const xj = (points[j].lng - center.lng) * metersPerDegreeLng;
    const yj = (points[j].lat - center.lat) * metersPerDegreeLat;
    area += xj * yi - xi * yj;
  }

  return Math.abs(area / 2);
}

function EditHandler({ points, onChange }: { points: BoundaryPoint[]; onChange: (points: BoundaryPoint[]) => void }) {
  useMapEvents({
    click(event) {
      const next = [...points, { lat: event.latlng.lat, lng: event.latlng.lng }];
      onChange(next);
    },
    contextmenu() {
      if (points.length === 0) return;
      onChange(points.slice(0, -1));
    },
  });

  return null;
}

function FitBoundary({ points }: { points: BoundaryPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length < 3) return;
    const positions = toClosedPolygon(points).map((point) => [point.lat, point.lng] as [number, number]);
    map.fitBounds(positions, { padding: [14, 14] });
  }, [map, points]);

  return null;
}

export default function CollegeBoundaryEditor({ points, onChange, heightClassName = "h-56" }: CollegeBoundaryEditorProps) {
  const center = useMemo(() => centroid(points), [points]);
  const polygon = useMemo(() => toClosedPolygon(points), [points]);
  const areaM2 = useMemo(() => computePolygonAreaMeters(points), [points]);
  const [jsonText, setJsonText] = useState<string>(JSON.stringify(points, null, 2));
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [history, setHistory] = useState<BoundaryPoint[][]>([]);
  const [future, setFuture] = useState<BoundaryPoint[][]>([]);
  const internalUpdateRef = useRef(false);

  useEffect(() => {
    setJsonText(JSON.stringify(points, null, 2));
  }, [points]);

  useEffect(() => {
    if (internalUpdateRef.current) {
      internalUpdateRef.current = false;
      return;
    }
    setHistory([]);
    setFuture([]);
  }, [points]);

  const applyChange = (next: BoundaryPoint[]) => {
    internalUpdateRef.current = true;
    setHistory((prev) => [...prev, points]);
    setFuture([]);
    onChange(next);
  };

  const handleUndo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    internalUpdateRef.current = true;
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [points, ...prev]);
    onChange(previous);
  };

  const handleRedo = () => {
    const next = future[0];
    if (!next) return;
    internalUpdateRef.current = true;
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, points]);
    onChange(next);
  };

  const updatePointAt = (index: number, point: BoundaryPoint) => {
    const next = [...points];
    next[index] = point;
    applyChange(next);
  };

  const removePointAt = (index: number) => {
    if (index < 0 || index >= points.length) return;
    applyChange(points.filter((_, i) => i !== index));
  };

  const isClosed = points.length > 2
    && points[0].lat === points[points.length - 1].lat
    && points[0].lng === points[points.length - 1].lng;

  const endGapMeters = points.length > 2 ? distanceMeters(points[0], points[points.length - 1]) : null;
  const canSnapClose = points.length > 2 && !isClosed && endGapMeters !== null;

  const handleSnapClose = () => {
    if (!canSnapClose) return;
    applyChange([...points, { ...points[0] }]);
    setMessage({ type: "success", text: "Polygon snapped closed." });
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        setMessage({ type: "error", text: "Invalid JSON: expected an array of points." });
        return;
      }

      const normalized = parsed
        .map((entry) => {
          if (Array.isArray(entry) && entry.length >= 2) {
            return { lat: Number(entry[0]), lng: Number(entry[1]) };
          }
          if (entry && typeof entry === "object") {
            return {
              lat: Number((entry as { lat?: number }).lat),
              lng: Number((entry as { lng?: number }).lng),
            };
          }
          return null;
        })
        .filter((entry): entry is BoundaryPoint => Boolean(entry) && Number.isFinite(entry.lat) && Number.isFinite(entry.lng));

      if (normalized.length < 3) {
        setMessage({ type: "error", text: "Boundary needs at least 3 valid points." });
        return;
      }

      applyChange(normalized);
      setMessage({ type: "success", text: `Imported ${normalized.length} points.` });
    } catch {
      setMessage({ type: "error", text: "Invalid JSON format." });
    }
  };

  const handleExport = async () => {
    const text = JSON.stringify(points, null, 2);
    setJsonText(text);
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: "success", text: "Boundary JSON copied to clipboard." });
    } catch {
      setMessage({ type: "success", text: "Boundary JSON refreshed in editor." });
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground">
        Click map to add points. Drag points to adjust. Right click removes last point.
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={history.length === 0}
          className="px-2.5 py-1.5 rounded-lg text-[11px] bg-muted/50 hover:bg-muted text-muted-foreground disabled:opacity-50"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={future.length === 0}
          className="px-2.5 py-1.5 rounded-lg text-[11px] bg-muted/50 hover:bg-muted text-muted-foreground disabled:opacity-50"
        >
          Redo
        </button>
      </div>
      <div className={`w-full rounded-xl overflow-hidden border border-border/60 ${heightClassName}`}>
        <MapContainer center={[center.lat, center.lng]} zoom={16} className="w-full h-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <EditHandler points={points} onChange={onChange} />
          <FitBoundary points={points} />

          {polygon.length >= 3 && (
            <Polygon
              positions={polygon.map((point) => [point.lat, point.lng] as [number, number])}
              pathOptions={{
                color: "#10b981",
                weight: 2,
                fillColor: "#34d399",
                fillOpacity: 0.14,
              }}
            />
          )}

          {points.map((point, index) => (
            <Marker
              key={`${point.lat}-${point.lng}-${index}`}
              position={[point.lat, point.lng]}
              icon={vertexIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const marker = event.target as L.Marker;
                  const latLng = marker.getLatLng();
                  updatePointAt(index, { lat: latLng.lat, lng: latLng.lng });
                },
              }}
            />
          ))}
        </MapContainer>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground">
          {points.length} points selected{areaM2 > 0 ? ` • area ${Math.round(areaM2).toLocaleString()} m2` : ""}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyChange([])}
            className="px-2.5 py-1.5 rounded-lg text-[11px] bg-muted/50 hover:bg-muted text-muted-foreground"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="px-2.5 py-1.5 rounded-lg text-[11px] bg-primary/20 hover:bg-primary/30 text-primary"
          >
            Export JSON
          </button>
        </div>
      </div>

      {canSnapClose && endGapMeters !== null && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
          <span className="text-[11px] text-amber-300">
            Polygon is open. End-to-start gap is {Math.round(endGapMeters)}m.
          </span>
          <button
            type="button"
            onClick={handleSnapClose}
            className="px-2.5 py-1 rounded text-[11px] bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
          >
            Snap Close
          </button>
        </div>
      )}

      {endGapMeters !== null && endGapMeters > SNAP_DISTANCE_METERS && !isClosed && (
        <div className="text-[11px] text-amber-300">
          Hint: keep first and last point close to avoid shape drift when auto-closing on save.
        </div>
      )}

      {message && (
        <div className={`text-[11px] ${message.type === "error" ? "text-destructive" : "text-green-500"}`}>
          {message.text}
        </div>
      )}

      <textarea
        title="Boundary JSON"
        value={jsonText}
        onChange={(event) => setJsonText(event.target.value)}
        rows={5}
        className="w-full bg-muted/50 border border-border rounded-xl py-2 px-3 text-xs font-mono"
      />
      <button
        type="button"
        onClick={handleImport}
        className="px-3 py-2 rounded-lg text-xs bg-muted/50 hover:bg-muted text-muted-foreground"
      >
        Import JSON
      </button>

      {points.length > 0 && (
        <div className="space-y-1 max-h-28 overflow-auto border border-border/40 rounded-lg p-2">
          {points.map((point, index) => (
            <div key={`row-${index}`} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-muted-foreground">#{index + 1} ({point.lat.toFixed(6)}, {point.lng.toFixed(6)})</span>
              <button
                type="button"
                onClick={() => removePointAt(index)}
                className="px-2 py-0.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
