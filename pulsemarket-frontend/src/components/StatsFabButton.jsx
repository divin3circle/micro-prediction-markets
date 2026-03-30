export function StatsFabButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-4 rounded-full bg-[#7C5CFC] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_30px_rgba(124,92,252,0.35)]"
    >
      📊 Stats
    </button>
  );
}
