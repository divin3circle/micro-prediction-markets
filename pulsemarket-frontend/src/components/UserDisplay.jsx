import { useInitiaUsername } from "../hooks/useInitiaUsername";

function truncateAddress(value) {
  if (!value) return "";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export function UserDisplay({ address, className = "" }) {
  const { username, loading } = useInitiaUsername(address);

  if (loading) {
    return (
      <span
        className={`inline-block h-5 w-28 animate-pulse rounded-full bg-[#2A2A35] ${className}`}
      />
    );
  }

  if (username) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <span>{username}</span>
        <span className="text-[#7C5CFC]">✓</span>
      </span>
    );
  }

  return <span className={className}>{truncateAddress(address)}</span>;
}
