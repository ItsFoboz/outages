const TYPE_CONFIG = {
  electricity: {
    label: "Ток",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    icon: "⚡",
  },
  water: {
    label: "Вода",
    color: "#38BDF8",
    bg: "rgba(56,189,248,0.1)",
    icon: "💧",
  },
  heating: {
    label: "Парно",
    color: "#F97316",
    bg: "rgba(249,115,22,0.1)",
    icon: "🔥",
  },
};

export default function SummaryStrip({ summary, activeType, onTypeClick }) {
  const counts = { electricity: 0, water: 0, heating: 0 };

  if (summary?.byType) {
    for (const item of summary.byType) {
      if (item.type in counts) counts[item.type] = item.count;
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        marginBottom: 16,
      }}
    >
      {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
        const isActive = activeType === type;
        return (
          <button
            key={type}
            onClick={() => onTypeClick(isActive ? "all" : type)}
            style={{
              background: isActive ? cfg.bg : "#1A1D27",
              border: `1px solid ${isActive ? cfg.color + "40" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8,
              padding: "14px 16px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: cfg.color,
                  marginBottom: 6,
                }}
              >
                {cfg.icon} {cfg.label}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: isActive ? cfg.color : "#F1F5F9",
                  lineHeight: 1,
                }}
              >
                {counts[type]}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#64748B",
                  marginTop: 4,
                }}
              >
                {counts[type] === 1 ? "авария" : "аварии"}
              </div>
            </div>
            <div
              style={{
                fontSize: 32,
                opacity: 0.2,
              }}
            >
              {cfg.icon}
            </div>
          </button>
        );
      })}
    </div>
  );
}
