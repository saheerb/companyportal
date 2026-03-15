interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "blue" | "green" | "red" | "yellow" | "gray";
}

const colorMap = {
  blue: "bg-blue-50 border-blue-200 text-blue-600",
  green: "bg-green-50 border-green-200 text-green-600",
  red: "bg-red-50 border-red-200 text-red-600",
  yellow: "bg-yellow-50 border-yellow-200 text-yellow-600",
  gray: "bg-gray-50 border-gray-200 text-gray-600",
};

export default function StatCard({ title, value, subtitle, color = "blue" }: StatCardProps) {
  return (
    <div className={`rounded-lg border p-5 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs mt-1 opacity-70">{subtitle}</p>}
    </div>
  );
}
