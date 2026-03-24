"use client";

import { useState } from "react";

interface BarChartDatum {
  mois: string;
  leads: number;
  abonnes: number;
}

interface BarChartProps {
  data: BarChartDatum[];
}

export function BarChart({ data }: BarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(...data.flatMap((d) => [d.leads, d.abonnes]), 1);

  const formatMonth = (mois: string) => {
    const [y, m] = mois.split("-");
    const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1]} ${y?.slice(2)}`;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Aucune donnee mensuelle disponible
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex items-center gap-5 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-300 inline-block" />
          <span className="text-xs text-gray-500">Leads</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#0A3855] inline-block" />
          <span className="text-xs text-gray-500">Abonnes</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex items-end gap-1 sm:gap-2 overflow-x-auto pb-2">
        {data.map((d, i) => {
          const leadsPct = (d.leads / maxVal) * 100;
          const abonnesPct = (d.abonnes / maxVal) * 100;

          return (
            <div
              key={d.mois}
              className="flex-1 min-w-[48px] flex flex-col items-center relative group"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {hoveredIdx === i && (
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10 whitespace-nowrap">
                  <div className="font-semibold mb-1">{formatMonth(d.mois)}</div>
                  <div>Leads: {d.leads}</div>
                  <div>Abonnes: {d.abonnes}</div>
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900 rotate-45" />
                </div>
              )}

              {/* Numbers above bars */}
              <div className="flex gap-1 mb-1 text-[10px] text-gray-400 font-medium">
                <span>{d.leads}</span>
                <span className="text-[#0A3855]">{d.abonnes}</span>
              </div>

              {/* Bars container */}
              <div className="flex items-end gap-0.5 w-full h-32">
                {/* Leads bar */}
                <div className="flex-1 flex items-end justify-center">
                  <div
                    className="w-full max-w-[20px] bg-gray-300 rounded-t transition-all duration-300 hover:bg-gray-400 min-h-[2px]"
                    style={{ height: `${leadsPct}%` }}
                  />
                </div>
                {/* Abonnes bar */}
                <div className="flex-1 flex items-end justify-center">
                  <div
                    className="w-full max-w-[20px] bg-[#0A3855] rounded-t transition-all duration-300 hover:bg-[#1a5a7a] min-h-[2px]"
                    style={{ height: `${abonnesPct}%` }}
                  />
                </div>
              </div>

              {/* Month label */}
              <div className="mt-2 text-[10px] text-gray-400 font-medium">
                {formatMonth(d.mois)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
