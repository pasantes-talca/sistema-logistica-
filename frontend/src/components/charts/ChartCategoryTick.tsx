type Props = {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string | number };
  maxCharacters?: number;
  maxLines?: number;
};

function linesFor(text: string, limit: number, maxLines: number) {
  const words = text
    .trim()
    .split(/\s+/)
    .flatMap((word) =>
      word.length > limit
        ? word.match(new RegExp(`.{1,${limit}}`, "gu")) || []
        : [word],
    );
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && (line + " " + word).length > limit) {
      lines.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines)
    return [
      ...lines.slice(0, maxLines - 1),
      lines[maxLines - 1].slice(0, limit - 1) + "…",
    ];
  return lines;
}

/** El título conserva el texto completo; el tooltip del gráfico no se altera. */
export default function ChartCategoryTick({
  x = 0,
  y = 0,
  payload,
  maxCharacters = 19,
  maxLines = 4,
}: Props) {
  const text = String(payload?.value ?? "");
  return (
    <g transform={`translate(${x},${y})`} className="chart-category-tick">
      <title>{text}</title>
      <text textAnchor="middle" fill="#657289" fontSize={11}>
        {linesFor(text, maxCharacters, maxLines).map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 16 : 15}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
