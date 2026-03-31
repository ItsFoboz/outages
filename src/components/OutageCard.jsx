import { useState } from "react";

const TYPE_CONFIG = {
  electricity: {
    label: "Ток",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    icon: "⚡",
  },
  water: {
    label: "Вода",
    color: "#38BDF8",
    bg: "rgba(56,189,248,0.12)",
    icon: "💧",
  },
  heating: {
    label: "Парно",
    color: "#F97316",
    bg: "rgba(249,115,22,0.12)",
    icon: "🔥",
  },
};

const STATUS_CONFIG = {
  active: { label: "Активна", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  planned: { label: "Планирана", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  resolved: { label: "Отстранена", color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
};

function formatTime(isoStr) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

const NEIGHBORHOODS_TRUNCATE = 160;

export default function OutageCard({ outage }) {
  const [expanded, setExpanded] = useState(false);

  const typeCfg = TYPE_CONFIG[outage.type] || {
    label: outage.type,
    color: "#94A3B8",
    bg: "rgba(148,163,184,0.12)",
    icon: "ℹ",
  };
  const statusCfg = STATUS_CONFIG[outage.status] || STATUS_CONFIG.active;

  const neighborhoods = outage.neighborhoods || "";
  const isLong = neighborhoods.length > NEIGHBORHOODS_TRUNCATE;
  const displayNeighborhoods =
    isLong && !expanded
      ? neighborhoods.substring(0, NEIGHBORHOODS_TRUNCATE) + "…"
      : neighborhoods;

  const startFmt = formatTime(outage.start_time);
  const endFmt = formatTime(outage.end_time);

  return (
    <div
      style={{
        background: "#21252F",
        border: "1px solid rgba(255,255,255,0.07)",
        borderLeft: `3px solid ${typeCfg.color}`,
        borderRadius: 8,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "border-color 0.15s",
      }}
    >
      {/* Top row: type badge + status badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              background: typeCfg.bg,
              color: typeCfg.color,
              padding: "3px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {typeCfg.icon} {typeCfg.label}
          </span>
          <span
            style={{
              background: statusCfg.bg,
              color: statusCfg.color,
              padding: "3px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            {statusCfg.label}
          </span>
        </div>

        {outage.source_url && (
          <a
            href={outage.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: "#475569",
              textDecoration: "none",
              borderBottom: "1px solid rgba(71,85,105,0.4)",
              transition: "color 0.15s",
            }}
            onMouseOver={(e) => (e.target.style.color = "#94A3B8")}
            onMouseOut={(e) => (e.target.style.color = "#475569")}
          >
            Източник ↗
          </a>
        )}
      </div>

      {/* Provider + region */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#F1F5F9",
            marginBottom: 2,
          }}
        >
          {outage.provider}
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8" }}>
          {[outage.region, outage.city]
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
            .join(" › ")}
        </div>
      </div>

      {/* Neighborhoods */}
      {neighborhoods && (
        <div>
          <div
            style={{
              fontSize: 12,
              color: "#CBD5E1",
              lineHeight: 1.6,
            }}
          >
            {displayNeighborhoods}
          </div>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                marginTop: 4,
                background: "none",
                border: "none",
                color: "#64748B",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              {expanded ? "Скрий" : "Покажи всички"}
            </button>
          )}
        </div>
      )}

      {/* Description (if different from neighborhoods) */}
      {outage.description &&
        outage.description !== outage.neighborhoods &&
        outage.description.length > 5 && (
          <div
            style={{
              fontSize: 12,
              color: "#64748B",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: 8,
              lineHeight: 1.5,
            }}
          >
            {outage.description.substring(0, 300)}
          </div>
        )}

      {/* Time window */}
      {(startFmt || endFmt) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#94A3B8",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>🕐</span>
          {startFmt && <span>{startFmt}</span>}
          {startFmt && endFmt && (
            <span style={{ color: "#475569" }}>→</span>
          )}
          {endFmt && <span>{endFmt}</span>}
          {!startFmt && !endFmt && (
            <span style={{ color: "#64748B" }}>Текущо</span>
          )}
        </div>
      )}
    </div>
  );
}
