import { useState, useEffect, useCallback } from "react";
import SummaryStrip from "./components/SummaryStrip.jsx";
import FilterBar from "./components/FilterBar.jsx";
import OutageCard from "./components/OutageCard.jsx";
import OutageMap from "./components/OutageMap.jsx";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // auto-refresh every 5 min

export default function App() {
  const [outages, setOutages] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stale, setStale] = useState(false);

  const [typeFilter, setTypeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [view, setView] = useState("list"); // "list" | "map"

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (regionFilter !== "all") params.set("region", regionFilter);

      const [outagesRes, summaryRes] = await Promise.all([
        fetch(`/api/outages?${params}`),
        fetch("/api/outages/summary"),
      ]);

      if (!outagesRes.ok || !summaryRes.ok) throw new Error("Server error");

      const [outagesData, summaryData] = await Promise.all([
        outagesRes.json(),
        summaryRes.json(),
      ]);

      setOutages(outagesData);
      setSummary(summaryData);
      setLastUpdated(new Date());
      setError(null);
      setStale(false);
    } catch (err) {
      if (!silent) {
        setError(err.message);
        setStale(true);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [typeFilter, regionFilter]);

  // Initial load and filter changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleManualRefresh = async () => {
    // Trigger backend scrape cycle
    fetch("/api/refresh", { method: "POST" }).catch(() => {});
    // Reload data after a short delay to allow scrape to start
    setTimeout(() => fetchData(), 2000);
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return "";
    return lastUpdated.toLocaleTimeString("bg-BG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen" style={{ background: "#0F1117" }}>
      {/* Header */}
      <header
        style={{
          background: "#1A1D27",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#F1F5F9",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              БГ Аварии
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "#94A3B8",
                margin: "2px 0 0",
              }}
            >
              Актуални прекъсвания на ток, вода и парно в България
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* View toggle */}
            <div
              style={{
                display: "flex",
                gap: 4,
                background: "#0F1117",
                padding: 4,
                borderRadius: 8,
              }}
            >
              <ViewBtn
                active={view === "list"}
                onClick={() => setView("list")}
                label="☰ Списък"
              />
              <ViewBtn
                active={view === "map"}
                onClick={() => setView("map")}
                label="🗺 Карта"
              />
            </div>

            {/* Last updated + refresh */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "#64748B",
              }}
            >
              {lastUpdated && <span>Обновено: {formatLastUpdated()}</span>}
              {stale && (
                <span
                  style={{
                    color: "#F59E0B",
                    fontSize: 11,
                    padding: "2px 8px",
                    background: "rgba(245,158,11,0.1)",
                    borderRadius: 4,
                  }}
                >
                  ⚠ Данните може да са остарели
                </span>
              )}
              <button
                onClick={handleManualRefresh}
                disabled={loading}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#94A3B8",
                  borderRadius: 6,
                  padding: "5px 12px",
                  fontSize: 12,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                  transition: "all 0.15s",
                }}
              >
                {loading ? "…" : "↻ Обнови"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "16px" }}>
        {/* Summary strip */}
        {summary && (
          <SummaryStrip
            summary={summary}
            activeType={typeFilter}
            onTypeClick={setTypeFilter}
          />
        )}

        {/* Filter bar */}
        <FilterBar
          typeFilter={typeFilter}
          regionFilter={regionFilter}
          onTypeChange={setTypeFilter}
          onRegionChange={setRegionFilter}
        />

        {/* Map or list */}
        {view === "map" ? (
          <div
            style={{
              height: "calc(100vh - 220px)",
              minHeight: 400,
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <OutageMap filter={typeFilter} />
          </div>
        ) : (
          <>
            {loading && outages.length === 0 && <LoadingState />}
            {!loading && error && outages.length === 0 && (
              <ErrorState message={error} onRetry={() => fetchData()} />
            )}
            {!loading && outages.length === 0 && !error && <EmptyState />}
            {outages.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 480px), 1fr))",
                  gap: 12,
                }}
              >
                {outages.map((outage) => (
                  <OutageCard key={outage.id} outage={outage} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ViewBtn({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 14px",
        borderRadius: 6,
        border: "none",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s",
        background: active ? "#21252F" : "transparent",
        color: active ? "#F1F5F9" : "#64748B",
      }}
    >
      {label}
    </button>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 16px",
        color: "#94A3B8",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(255,255,255,0.1)",
          borderTopColor: "#F59E0B",
          borderRadius: "50%",
          margin: "0 auto 16px",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ margin: 0, fontSize: 14 }}>Зареждане на данните…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 16px",
        color: "#94A3B8",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
      <p
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 500,
          color: "#F1F5F9",
        }}
      >
        Няма регистрирани аварии
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 14 }}>
        Няма регистрирани аварии в момента за избрания регион.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 16px",
        color: "#94A3B8",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
      <p
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 500,
          color: "#EF4444",
        }}
      >
        Грешка при зареждане
      </p>
      <p style={{ margin: "8px 0 16px", fontSize: 14 }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          background: "rgba(239,68,68,0.15)",
          border: "1px solid rgba(239,68,68,0.3)",
          color: "#EF4444",
          borderRadius: 6,
          padding: "8px 20px",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Опитай отново
      </button>
    </div>
  );
}
