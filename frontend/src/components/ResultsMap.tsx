import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { PropertySummary } from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/utils/format";

// Leaflet's default marker icon paths break under bundlers (Vite included)
// because they're referenced as relative strings baked into the library --
// this is the standard documented fix: re-point them at the actual
// bundled asset URLs Vite produces for these images.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points, { padding: [32, 32] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => p.join(",")).join("|")]);
  return null;
}

/**
 * Real map view for search results -- plots a pin for every result that
 * actually has coordinates (PropertySummary.latitude/longitude are real
 * backend fields, not fabricated). Uses Leaflet + OpenStreetMap tiles,
 * which is free and needs no paid API key, rather than the Google Maps JS
 * SDK (which would require a client-exposed billing key this app doesn't
 * have configured -- out of scope to add here).
 */
export function ResultsMap({ items }: { items: PropertySummary[] }) {
  const navigate = useNavigate();
  const withCoords = items.filter(
    (item): item is PropertySummary & { latitude: number; longitude: number } =>
      item.latitude !== null && item.longitude !== null,
  );

  if (withCoords.length === 0) {
    return (
      <EmptyState
        title="No map locations for these results"
        description="None of the current results have coordinates on file yet. Try List or Grid view instead."
      />
    );
  }

  const points: [number, number][] = withCoords.map((item) => [item.latitude, item.longitude]);
  const center = points[0];

  return (
    <div className="results-map">
      <MapContainer center={center} zoom={12} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {withCoords.map((item) => (
          <Marker key={item.id} position={[item.latitude, item.longitude]}>
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div className="results-map__popup-price">{formatCurrency(item.rentAmount)}/mo</div>
                <div style={{ fontWeight: 600, margin: "2px 0 6px" }}>{item.title}</div>
                <button
                  type="button"
                  className="btn-v2 btn-v2--primary btn-v2--sm"
                  style={{ width: "100%" }}
                  onClick={() => navigate(`/properties/${item.id}`)}
                >
                  View details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
