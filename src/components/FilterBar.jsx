const REGIONS = [
  { value: "all", label: "Всички региони" },
  { value: "София", label: "София" },
  { value: "Пловдив", label: "Пловдив" },
  { value: "Варна", label: "Варна" },
  { value: "Бургас", label: "Бургас" },
  { value: "Стара Загора", label: "Стара Загора" },
  { value: "Хасково", label: "Хасково" },
  { value: "Ямбол", label: "Ямбол" },
  { value: "Сливен", label: "Сливен" },
  { value: "Русе", label: "Русе" },
  { value: "Благоевград", label: "Благоевград" },
  { value: "Монтана", label: "Монтана" },
  { value: "Видин", label: "Видин" },
  { value: "Враца", label: "Враца" },
  { value: "Ловеч", label: "Ловеч" },
  { value: "Плевен", label: "Плевен" },
  { value: "Перник", label: "Перник" },
  { value: "Кюстендил", label: "Кюстендил" },
  { value: "Велико Търново", label: "Велико Търново" },
  { value: "Габрово", label: "Габрово" },
  { value: "Разград", label: "Разград" },
  { value: "Търговище", label: "Търговище" },
  { value: "Шумен", label: "Шумен" },
  { value: "Добрич", label: "Добрич" },
  { value: "Кърджали", label: "Кърджали" },
  { value: "Смолян", label: "Смолян" },
  { value: "Пазарджик", label: "Пазарджик" },
  { value: "Силистра", label: "Силистра" },
  { value: "София Област", label: "София Област" },
];

const TYPES = [
  { value: "all", label: "Всички" },
  { value: "electricity", label: "⚡ Ток" },
  { value: "water", label: "💧 Вода" },
  { value: "heating", label: "🔥 Парно" },
];

const TYPE_ACCENT = {
  electricity: "#F59E0B",
  water: "#38BDF8",
  heating: "#F97316",
  all: "#94A3B8",
};

export default function FilterBar({
  typeFilter,
  regionFilter,
  onTypeChange,
  onRegionChange,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      {/* Type tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "#1A1D27",
          padding: 4,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {TYPES.map((t) => {
          const isActive = typeFilter === t.value;
          const accent = TYPE_ACCENT[t.value];
          return (
            <button
              key={t.value}
              onClick={() => onTypeChange(t.value)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "none",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                background: isActive ? "#21252F" : "transparent",
                color: isActive ? accent : "#94A3B8",
                boxShadow: isActive
                  ? `0 0 0 1px ${accent}30`
                  : "none",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Region dropdown */}
      <select
        value={regionFilter}
        onChange={(e) => onRegionChange(e.target.value)}
        style={{
          background: "#1A1D27",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          color: regionFilter === "all" ? "#94A3B8" : "#F1F5F9",
          fontSize: 13,
          padding: "7px 12px",
          cursor: "pointer",
          outline: "none",
          minWidth: 180,
        }}
      >
        {REGIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
