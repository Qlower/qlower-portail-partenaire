// Speedometer SVG semi-circulaire — style tableau de bord voiture.
//
// Affiche un pourcentage 0-150% (au-delà → 150 plafonné visuellement).
// L'aiguille pivote de -90° (gauche, 0%) à +90° (droite, 100%).
// Au-delà de 100%, l'aiguille continue jusqu'à 150% en mode "boost".
//
// Zones de couleur :
//   0-30%   : rouge (sous-performance)
//   30-70%  : orange (en retard)
//   70-100% : navy Qlower (à l'heure)
//   100%+   : vert (en dépassement)

interface Props {
  /** Pourcentage 0-150+ (>150 affiché à 150) */
  pct: number;
  /** Label central (ex: "152,8 %" ou "—") */
  label?: string;
  /** Sub-label sous le pourcentage (ex: "obj 25 000 € / réalisé 38 200 €") */
  sub?: string;
  /** Status text en haut (ex: "🎯 En avance") */
  status?: string;
  /** Taille en px (largeur). Hauteur ≈ largeur × 0.65 */
  size?: number;
}

export default function SpeedometerGauge({ pct, label, sub, status, size = 320 }: Props) {
  // Clamp pour le dessin
  const clamped = Math.max(0, Math.min(150, pct));
  // Aiguille : -90° à 0%, 0° à 75%, +90° à 150%
  // Mapping linéaire : angle = -90 + (clamped / 150) * 180
  const angle = -90 + (clamped / 150) * 180;

  // Coordonnées du centre (au milieu en bas du semi-cercle)
  const W = size;
  const H = Math.round(size * 0.65);
  const cx = W / 2;
  const cy = H * 0.85;
  const radius = (W / 2) * 0.85;
  const innerRadius = radius * 0.72;

  // Couleur de l'aiguille selon zone
  const needleColor =
    clamped >= 100 ? "#10B981" : clamped >= 70 ? "#0A3855" : clamped >= 30 ? "#F59E0B" : "#EF4444";

  // Helper : angle en radian (0 = haut, mais on tourne via -90 → +90)
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;

  // Calcule x,y sur le cercle pour un angle "speedometer" (-90 = gauche, +90 = droite)
  const pointAt = (deg: number, r: number) => {
    const rad = toRad(deg);
    return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r];
  };

  // Construit un arc SVG entre 2 angles
  const arcPath = (startDeg: number, endDeg: number, r: number, innerR: number) => {
    const [x0, y0] = pointAt(startDeg, r);
    const [x1, y1] = pointAt(endDeg, r);
    const [x2, y2] = pointAt(endDeg, innerR);
    const [x3, y3] = pointAt(startDeg, innerR);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} L ${x2} ${y2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x3} ${y3} Z`;
  };

  // Zones : 0-30 rouge, 30-70 orange, 70-100 navy, 100-150 vert
  // Conversion pct → angle : pct/150 * 180 - 90
  const pctToAngle = (p: number) => -90 + (p / 150) * 180;
  const zones = [
    { from: 0, to: 30, color: "#FCA5A5" },
    { from: 30, to: 70, color: "#FCD34D" },
    { from: 70, to: 100, color: "#93C5FD" },
    { from: 100, to: 150, color: "#86EFAC" },
  ];

  // Position de l'aiguille (ligne du centre vers le bord)
  const [nx, ny] = pointAt(angle, radius * 0.9);

  // Ticks aux multiples de 25%
  const ticks = [0, 25, 50, 75, 100, 125, 150];

  return (
    <div className="inline-block" aria-label={`Compteur d'objectif : ${pct.toFixed(0)}%`}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="overflow-visible">
        {/* Zones colorées */}
        {zones.map((z) => (
          <path
            key={z.from}
            d={arcPath(pctToAngle(z.from), pctToAngle(z.to), radius, innerRadius)}
            fill={z.color}
            opacity={0.55}
          />
        ))}

        {/* Ticks + labels */}
        {ticks.map((t) => {
          const a = pctToAngle(t);
          const [tx1, ty1] = pointAt(a, radius);
          const [tx2, ty2] = pointAt(a, radius * 1.04);
          const [lx, ly] = pointAt(a, radius * 1.16);
          return (
            <g key={t}>
              <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#475569" strokeWidth={1.5} />
              <text
                x={lx}
                y={ly}
                fontSize={W * 0.04}
                fill="#475569"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="ui-monospace, monospace"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* Aiguille */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={needleColor}
          strokeWidth={3.5}
          strokeLinecap="round"
          style={{ transition: "all 0.6s ease-out" }}
        />
        {/* Centre / pivot */}
        <circle cx={cx} cy={cy} r={W * 0.04} fill="#0A3855" />
        <circle cx={cx} cy={cy} r={W * 0.02} fill={needleColor} />

        {/* Texte central */}
        <text
          x={cx}
          y={cy - radius * 0.45}
          fontSize={W * 0.13}
          fontWeight={700}
          fill={needleColor}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
        >
          {label || `${Math.round(pct)} %`}
        </text>

        {/* Sub-label */}
        {sub && (
          <text
            x={cx}
            y={cy - radius * 0.22}
            fontSize={W * 0.038}
            fill="#64748B"
            textAnchor="middle"
          >
            {sub}
          </text>
        )}

        {/* Status en haut */}
        {status && (
          <text
            x={cx}
            y={H * 0.1}
            fontSize={W * 0.045}
            fontWeight={600}
            fill={needleColor}
            textAnchor="middle"
          >
            {status}
          </text>
        )}
      </svg>
    </div>
  );
}
