export default function Gauge({ value, min, max, color, size = 100 }) {
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const angle = -135 + pct * 270;
  const radius = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;

  const arcPath = (start, end) => {
    const s = ((start - 90) * Math.PI) / 180;
    const e = ((end - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(s);
    const y1 = cy + radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e);
    const y2 = cy + radius * Math.sin(e);
    const large = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <svg width={size} height={size * 0.85} viewBox={`0 0 ${size} ${size * 0.85}`} aria-hidden="true">
      <path d={arcPath(-135, 135)} fill="none" stroke="#1a2535" strokeWidth={size * 0.06} strokeLinecap="round" />
      <path
        d={arcPath(-135, -135 + pct * 270)}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.06}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 ${size * 0.03}px ${color})` }}
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx + radius * 0.65 * Math.cos(((angle - 90) * Math.PI) / 180)}
        y2={cy + radius * 0.65 * Math.sin(((angle - 90) * Math.PI) / 180)}
        stroke={color}
        strokeWidth={size * 0.025}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={size * 0.035} fill={color} />
    </svg>
  );
}
