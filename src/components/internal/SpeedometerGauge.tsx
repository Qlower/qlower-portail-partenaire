// Speedometer SVG semi-circulaire — style tableau de bord voiture.
//
// Aiguille pivote de -90° (gauche, 0%) à +90° (droite, 150%).
// Zones alignées sur les ticks pour cohérence visuelle :
//   0-25%   : rouge (sous-performance)
//   25-75%  : orange (en retard)
//   75-100% : navy Qlower (à l'heure)
//   100%+   : vert (en dépassement)
//
// Le status text ("🎯 +1.5j d'avance") est rendu HTML au-dessus pour éviter
// tout chevauchement avec les ticks du SVG.

interface Props {
  /** Pourcentage 0-150+ (>150 affiché à 150) */
  pct: number;
  /** Label central (ex: "152,8 %" ou "—") */
  label?: string;
  /** Sub-label sous le pourcentage (ex: "obj 25 000 € / réalisé 38 200 €") */
  sub?: string;
  /** Status text au-dessus du gauge (HTML, ex: "🎯 En avance") */
  status?: string;
  /** Taille en px (largeur). Hauteur ≈ largeur × 0.65 */
  size?: number;
}

export default function SpeedometerGauge({ pct, label, sub, status, size = 320 }: Props) {
  // Clamp pour le dessin
  const clamped = Math.max(0, Math.min(150, pct));
  // Mapping linéaire : angle = -90 + (clamped / 150) * 180
  const angle = -90 + (clamped / 150) * 180;

  // Coordonnées
  const W = size;
  const H = Math.round(size * 0.6);
  const cx = W / 2;
  const cy = H * 0.92;
  const radius = (W / 2) * 0.78;
  const innerRadius = radius * 0.74;

  // Couleur de l'aiguille selon zone (cohérent avec les zones colorées)
  const needleColor =
    clamped >= 100 ? "#059669" : clamped >= 75 ? "#0A3855" : clamped >= 25 ? "#D97706" : "#DC2626";

  // Helper : angle en radian (style speedometer)
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;

  const pointAt = (deg: number, r: number) => {
    const rad = toRad(deg);
    return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r];
  };

  // Arc SVG entre 2 angles (avec épaisseur radius - innerR)
  const arcPath = (startDeg: number, endDeg: number, r: number, innerR: number) => {
    const [x0, y0] = pointAt(startDeg, r);
    const [x1, y1] = pointAt(endDeg, r);
    const [x2, y2] = pointAt(endDeg, innerR);
    const [x3, y3] = pointAt(startDeg, innerR);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} L ${x2} ${y2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x3} ${y3} Z`;
  };

  // Pct → angle dans le speedometer (-90 à +90)
  const pctToAngle = (p: number) => -90 + (p / 150) * 180;

  // Zones alignées sur les ticks : 0-25, 25-75, 75-100, 100-150
  const zones = [
    { from: 0, to: 25, color: "#FCA5A5" },   // rouge clair
    { from: 25, to: 75, color: "#FCD34D" },  // orange
    { from: 75, to: 100, color: "#93C5FD" }, // bleu clair
    { from: 100, to: 150, color: "#86EFAC" }, // vert
  ];

  // Position de l'aiguille
  const [nx, ny] = pointAt(angle, radius * 0.95);

  // Ticks aux multiples de 25%
  const ticks = [0, 25, 50, 75, 100, 125, 150];

  return (
    <div className="inline-flex flex-col items-center" aria-label={`Compteur d'objectif : ${pct.toFixed(0)}%`}>
      {/* Status text — rendu HTML au-dessus pour éviter tout chevauchement */}
      {status && (
        <div
          className="text-sm font-semibold mb-1"
          style={{ color: needleColor }}
        >
          {status}
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="overflow-visible">
        {/* Zones colorées */}
        {zones.map((z) => (
          <path
            key={z.from}
            d={arcPath(pctToAngle(z.from), pctToAngle(z.to), radius, innerRadius)}
            fill={z.color}
            opacity={0.65}
          />
        ))}

        {/* Ticks (uniquement les marques, pas les labels) */}
        {ticks.map((t) => {
          const a = pctToAngle(t);
          const [tx1, ty1] = pointAt(a, radius);
          const [tx2, ty2] = pointAt(a, radius * 1.05);
          return (
            <line
              key={`tick-${t}`}
              x1={tx1}
              y1={ty1}
              x2={tx2}
              y2={ty2}
              stroke="#475569"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Labels des ticks — placés bien au-delà du cercle pour éviter
            le chevauchement avec le texte central */}
        {ticks.map((t) => {
          const a = pctToAngle(t);
          const [lx, ly] = pointAt(a, radius * 1.22);
          return (
            <text
              key={`label-${t}`}
              x={lx}
              y={ly}
              fontSize={W * 0.038}
              fill="#475569"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="ui-monospace, monospace"
            >
              {t}
            </text>
          );
        })}

        {/* Texte central : pourcentage géant */}
        <text
          x={cx}
          y={cy - radius * 0.48}
          fontSize={W * 0.13}
          fontWeight={700}
          fill={needleColor}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
        >
          {label || `${Math.round(pct)} %`}
        </text>

        {/* Sub-label : réalisé / objectif */}
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
        {/* Pivot central */}
        <circle cx={cx} cy={cy} r={W * 0.04} fill="#0A3855" />
        <circle cx={cx} cy={cy} r={W * 0.02} fill={needleColor} />
      </svg>
    </div>
  );
}
