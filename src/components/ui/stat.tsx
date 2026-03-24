import { ReactNode } from "react";

interface StatProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  color?: string;
  subtitle?: string;
}

export function Stat({ icon, value, label, subtitle }: StatProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#E5EDF1] flex items-center justify-center text-[#0A3855] shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
          <p className="text-xs text-gray-500 truncate">{label}</p>
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
