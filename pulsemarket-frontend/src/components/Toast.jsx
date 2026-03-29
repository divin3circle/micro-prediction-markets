export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed right-4 top-4 z-50 rounded-xl border-l-4 border-[#22C55E] bg-[#16161A] px-4 py-3 text-sm text-white shadow-2xl">
      {message}
    </div>
  );
}
