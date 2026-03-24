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
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <span className="text-sm text-gray-400">Aucune donnee mensuelle disponible</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex items-center gap-6 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />
          <span className="text-xs text-gray-500 font-medium">Leads</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0A3855] inline-block" />
          <span className="text-xs text-gray-500 font-medium">Abonnes</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex items-end gap-1.5 sm:gap-3 overflow-x-auto pb-2">
        {/* Subtle horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ height: "128px", bottom: "auto" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-full border-b border-dashed border-gray-100" />
          ))}
        </div>

        {data.map((d, i) => {
          const leadsPct = (d.leads / maxVal) * 100;
          const abonnesPct = (d.abonnes / maxVal) * 100;

          return (
            <div
              key={d.mois}
              className="flex-1 min-w-[52px] flex flex-col items-center relative"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {hoveredIdx === i && (
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 bg-white text-gray-800 text-xs rounded-xl px-4 py-3 shadow-xl shadow-gray-200/50 border border-gray-100 z-10 whitespace-nowrap">
                  <div className="font-bold text-[#0A3855] mb-1.5">{formatMonth(d.mois)}</div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                    <span className="text-gray-500">Leads:</span>
                    <span className="font-semibold tabular-nums">{d.leads}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0A3855]" />
                    <span className="text-gray-500">Abonnes:</span>
                    <span className="font-semibold tabular-nums">{d.abonnes}</span>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-b border-r border-gray-100 rotate-45" />
                </div>
              )}

              {/* Numbers above bars */}
              <div className="flex gap-1.5 mb-1.5 text-[10px] font-semibold tabular-nums">
                <span className="text-gray-400">{d.leads}</span>
                <span className="text-[#0A3855]">{d.abonnes}</span>
              </div>

              {/* Bars container */}
              <div className="flex items-end gap-1 w-full h-32">
                {/* Leads bar */}
                <div className="flex-1 flex items-end justify-center">
                  <div
                    className="w-full max-w-[22px] rounded-t-md bg-gradient-to-t from-gray-300 to-gray-200 transition-all duration-300 ease-out min-h-[3px]"
                    style={{
                      height: `${leadsPct}%`,
                      opacity: hoveredIdx === i ? 1 : 0.85,
                      transform: hoveredIdx === i ? "scaleY(1.02)" : "scaleY(1)",
                      transformOrigin: "bottom",
                    }}
                  />
                </div>
                {/* Abonnes bar */}
                <div className="flex-1 flex items-end justify-center">
                  <div
                    className="w-full max-w-[22px] rounded-t-md bg-gradient-to-t from-[#0A3855] to-[#0A3855]/70 transition-all duration-300 ease-out min-h-[3px]"
                    style={{
                      height: `${abonnesPct}%`,
                      opacity: hoveredIdx === i ? 1 : 0.85,
                      transform: hoveredIdx === i ? "scaleY(1.02)" : "scaleY(1)",
                      transformOrigin: "bottom",
                    }}
                  />
                </div>
              </div>

              {/* Month label */}
              <div className={`mt-3 text-[11px] font-medium transition-colors ${hoveredIdx === i ? "text-[#0A3855]" : "text-gray-400"}`}>
                {formatMonth(d.mois)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
