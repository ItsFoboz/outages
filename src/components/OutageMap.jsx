import { useEffect, useRef, useState } from "react";

const TYPE_COLORS = {
  electricity: "#F59E0B",
  water: "#38BDF8",
  heating: "#F97316",
};

const TYPE_LABELS = {
  electricity: "Ток",
  water: "Вода",
  heating: "Парно",
};

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1A1D27" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0F1117" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94A3B8" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#CBD5E1" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#21252F" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0F1117" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2D3748" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0D1B2A" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#38BDF8" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function OutageMap({ filter }) {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [outages, setOutages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapsReady, setMapsReady] = useState(false);
  const [noKey, setNoKey] = useState(false);

  // Check if Google Maps key is configured
  useEffect(() => {
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      setNoKey(true);
      setLoading(false);
    }
  }, []);

  // Fetch map data
  useEffect(() => {
    if (noKey) return;
    fetch("/api/outages/map")
      .then((r) => r.json())
      .then((data) => {
        setOutages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [noKey]);

  // Wait for Google Maps SDK
  useEffect(() => {
    if (noKey) return;
    if (window.google?.maps) {
      setMapsReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (window.google?.maps) {
        setMapsReady(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [noKey]);

  // Initialise map once SDK is ready
  useEffect(() => {
    if (!mapsReady || !mapRef.current || googleMapRef.current) return;

    googleMapRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 42.7339, lng: 25.4858 }, // Bulgaria centre
      zoom: 7,
      mapTypeId: "roadmap",
      styles: DARK_MAP_STYLE,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    infoWindowRef.current = new window.google.maps.InfoWindow();
  }, [mapsReady]);

  // Re-render markers when data or filter changes
  useEffect(() => {
    if (!googleMapRef.current || outages.length === 0) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const filtered =
      !filter || filter === "all"
        ? outages
        : outages.filter((o) => o.type === filter);

    filtered.forEach((outage) => {
      const color = TYPE_COLORS[outage.type] || "#94A3B8";

      const svgMarker = {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: color,
        fillOpacity: 0.95,
        strokeColor: "#0F1117",
        strokeWeight: 1.5,
        scale: 1.6,
        anchor: new window.google.maps.Point(12, 22),
      };

      const marker = new window.google.maps.Marker({
        position: { lat: outage.lat, lng: outage.lng },
        map: googleMapRef.current,
        icon: svgMarker,
        title: outage.neighborhoods || outage.description || "",
      });

      marker.addListener("click", () => {
        const statusBadge =
          outage.status === "active"
            ? `<span style="background:#EF444430;color:#EF4444;padding:2px 8px;border-radius:4px;font-size:11px;">Активна</span>`
            : `<span style="background:#3B82F630;color:#3B82F6;padding:2px 8px;border-radius:4px;font-size:11px;">Планирана</span>`;

        infoWindowRef.current.setContent(`
          <div style="
            font-family: Inter, sans-serif;
            background: #21252F;
            color: #F1F5F9;
            padding: 12px 16px;
            border-radius: 8px;
            max-width: 280px;
            line-height: 1.5;
          ">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="
                background:${color}22;
                color:${color};
                padding:2px 8px;
                border-radius:4px;
                font-size:11px;
                font-weight:600;
                text-transform:uppercase;
                letter-spacing:0.05em;
              ">${TYPE_LABELS[outage.type] || outage.type}</span>
              ${statusBadge}
            </div>
            <p style="font-weight:600;font-size:13px;margin:0 0 6px;">
              ${outage.neighborhoods || outage.city || outage.region}
            </p>
            <p style="font-size:12px;color:#94A3B8;margin:0 0 6px;">
              ${outage.description || ""}
            </p>
            ${
              outage.start_time
                ? `<p style="font-size:11px;color:#64748B;margin:0;">
                ${outage.start_time}${outage.end_time ? " → " + outage.end_time : ""}
              </p>`
                : ""
            }
            <p style="font-size:11px;color:#64748B;margin:4px 0 0;">
              ${outage.provider}
            </p>
          </div>
        `);
        infoWindowRef.current.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);
    });

    // Auto-fit bounds
    if (markersRef.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markersRef.current.forEach((m) => bounds.extend(m.getPosition()));
      googleMapRef.current.fitBounds(bounds, { padding: 48 });
      if (markersRef.current.length === 1) {
        googleMapRef.current.setZoom(14);
      }
    }
  }, [outages, filter, mapsReady]);

  if (noKey) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F1117",
          color: "#94A3B8",
          gap: 12,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40 }}>🗺</div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "#F1F5F9" }}>
          Картата не е конфигурирана
        </p>
        <p style={{ margin: 0, fontSize: 13 }}>
          Добавете <code style={{ color: "#F59E0B" }}>VITE_GOOGLE_MAPS_API_KEY</code> в{" "}
          <code>.env</code> за да активирате картата.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {(loading || !mapsReady) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0F1117",
            zIndex: 10,
            color: "#94A3B8",
            fontSize: 14,
          }}
        >
          Зареждане на картата…
        </div>
      )}

      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Legend overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: 16,
          zIndex: 10,
          background: "rgba(15,17,23,0.88)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {[
          { type: "electricity", label: "Ток", color: "#F59E0B" },
          { type: "water", label: "Вода", color: "#38BDF8" },
          { type: "heating", label: "Парно", color: "#F97316" },
        ].map(({ type, label, color }) => (
          <div
            key={type}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#F1F5F9",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
              }}
            />
            {label}
          </div>
        ))}
      </div>

      {/* Outage count overlay */}
      {outages.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            background: "rgba(15,17,23,0.88)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
            color: "#94A3B8",
          }}
        >
          {outages.length} маркирани аварии
        </div>
      )}
    </div>
  );
}
