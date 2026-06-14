interface DoshaBadgeProps {
  dosha?: string;
  size?: 'sm' | 'md' | 'lg';
}

const doshaColors: Record<string, { fill: string; bg: string; label: string }> = {
  vata: { fill: '#7A9E8A', bg: '#e3ebe3', label: 'Vāta' },
  pitta: { fill: '#C9A96E', bg: '#f5edd9', label: 'Pitta' },
  kapha: { fill: '#0D3B2E', bg: '#d1e0d9', label: 'Kapha' },
};

const sizes = {
  sm: { svg: 24, stroke: 2.5 },
  md: { svg: 32, stroke: 3 },
  lg: { svg: 44, stroke: 4 },
};

export default function DoshaBadge({ dosha, size = 'md' }: DoshaBadgeProps) {
  const info = dosha ? doshaColors[dosha.toLowerCase()] : null;
  if (!info) return null;

  const { svg, stroke } = sizes[size];

  // Tri-arc: three arcs forming a circle, each representing a dosha
  // Vata (top), Pitta (bottom-right), Kapha (bottom-left)
  const r = svg * 0.35;
  const cx = svg / 2;
  const cy = svg / 2;

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Dosha: ${info.label}`}
    >
      <svg
        width={svg}
        height={svg}
        viewBox={`0 0 ${svg} ${svg}`}
        className="flex-shrink-0"
      >
        {/* Outer ring */}
        <circle
          cx={cx} cy={cy} r={r + stroke * 0.8}
          fill="none"
          stroke={info.fill}
          strokeWidth={stroke * 0.4}
          opacity={0.3}
        />
        {/* Inner tri-arc based on dominant dosha */}
        {dosha?.toLowerCase() === 'vata' && (
          <path
            d={`M ${cx - r * 0.87} ${cy + r * 0.5} A ${r} ${r} 0 0 1 ${cx + r * 0.87} ${cy + r * 0.5}`}
            fill="none"
            stroke={info.fill}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
        {dosha?.toLowerCase() === 'pitta' && (
          <path
            d={`M ${cx - r * 0.87} ${cy - r * 0.5} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`}
            fill="none"
            stroke={info.fill}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
        {(!dosha || dosha?.toLowerCase() === 'kapha') && (
          <path
            d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r * 0.87} ${cy + r * 0.5}`}
            fill="none"
            stroke={info.fill}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={2.5} fill={info.fill} />
      </svg>
      {size !== 'sm' && (
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: info.fill }}>
          {info.label}
        </span>
      )}
    </span>
  );
}
