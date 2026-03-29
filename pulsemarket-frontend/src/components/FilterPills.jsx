const CATEGORIES = ["All", "sports", "crypto", "news"];

export function FilterPills({ value, onChange }) {
  return (
    <div className="sticky top-[73px] z-30 mb-4 rounded-2xl bg-[#121218]/90 p-2 backdrop-blur">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const active = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={`rounded-full px-3 py-1.5 text-sm transition active:scale-[0.97] ${
                active
                  ? "bg-[#7C5CFC] text-white"
                  : "bg-transparent text-[#6B7280] hover:text-[#D1D5DB]"
              }`}
            >
              {c === "All" ? c : c[0].toUpperCase() + c.slice(1)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
