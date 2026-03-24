interface StatProps {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
  subtitle?: string;
}

export function Stat({ icon, value, label, subtitle }: StatProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1 leading-tight">{label}</div>
      {subtitle && <div className="text-[10px] text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
}
