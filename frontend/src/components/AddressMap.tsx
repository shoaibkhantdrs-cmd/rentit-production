import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Same documented Vite/Leaflet default-icon fix as ResultsMap.tsx -- safe to
// run again here (idempotent), since this component is lazy-loaded
// separately and can't rely on ResultsMap.tsx having already run it.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function Recenter({ position, zoom }: { position: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1]]);
  return null;
}

export interface AddressMapProps {
  /** [latitude, longitude]. */
  position: [number, number];
  /** Called with the new [latitude, longitude] after the user drags the marker. */
  onMarkerMove: (latitude: number, longitude: number) => void;
  zoom?: number;
}

/**
 * Map for the List Property Address step (Phase 8, Part 4): shows a
 * draggable marker at the currently-resolved address, and lets the user
 * drag it to correct the pin if the geocoded location is slightly off. The
 * marker recenters automatically whenever `position` changes (e.g. after a
 * PIN code lookup resolves new coordinates).
 */
export function AddressMap({ position, onMarkerMove, zoom = 15 }: AddressMapProps) {
  const markerRef = useRef<L.Marker | null>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (!marker) return;
        const { lat, lng } = marker.getLatLng();
        onMarkerMove(lat, lng);
      },
    }),
    [onMarkerMove],
  );

  return (
    <div className="address-map" style={{ width: "100%", height: 280, borderRadius: 12, overflow: "hidden" }}>
      <MapContainer center={position} zoom={zoom} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter position={position} zoom={zoom} />
        <Marker
          position={position}
          draggable
          eventHandlers={eventHandlers}
          ref={(instance) => {
            markerRef.current = instance;
          }}
        />
      </MapContainer>
      <p className="field-hint">Drag the pin to correct your exact location if needed.</p>
    </div>
  );
}
