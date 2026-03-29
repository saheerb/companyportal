"use client";

type Publication = {
  platform: string;
  status: string;
};

const PLATFORMS = [
  { id: "facebook", label: "Facebook Marketplace" },
  { id: "autotrader", label: "AutoTrader" },
];

const PUB_STATUS_COLORS: Record<string, string> = {
  live: "text-green-600",
  pending: "text-yellow-600",
  publishing: "text-blue-600",
  failed: "text-red-500",
  removed: "text-gray-400",
};

export default function PlatformSelector({
  selected,
  onChange,
  publications,
}: {
  selected: string[];
  onChange: (platforms: string[]) => void;
  publications?: Publication[];
}) {
  function toggle(platformId: string) {
    if (selected.includes(platformId)) {
      onChange(selected.filter((p) => p !== platformId));
    } else {
      onChange([...selected, platformId]);
    }
  }

  function getPubStatus(platformId: string) {
    return publications?.find((p) => p.platform === platformId)?.status;
  }

  return (
    <div className="space-y-2">
      {PLATFORMS.map((platform) => {
        const pubStatus = getPubStatus(platform.id);
        const isChecked = selected.includes(platform.id);
        return (
          <label key={platform.id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggle(platform.id)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{platform.label}</p>
              {pubStatus && (
                <p className={`text-xs mt-0.5 ${PUB_STATUS_COLORS[pubStatus] ?? "text-gray-400"}`}>
                  {pubStatus === "live" ? "Currently live" : pubStatus === "removed" ? "Unpublished" : pubStatus}
                </p>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
