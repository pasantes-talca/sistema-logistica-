import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { ResponsiveContainer } from "recharts";
import Icon from "../ui/Icon";
import "./ScrollableChart.css";

type Props = {
  children: ReactNode;
  label: string;
  itemCount: number;
  itemWidth?: number;
  height?: number;
  axisSpace?: number;
};

/** Reserva espacio real por categoría; nunca recorta ni agrupa los datos. */
export default function ScrollableChart({
  children,
  label,
  itemCount,
  itemWidth = 140,
  height = 400,
  axisSpace = 96,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const hint = useId();
  const [position, setPosition] = useState({
    overflow: false,
    previous: false,
    next: false,
    offset: 0,
    max: 0,
    thumb: 40,
  });
  const minWidth = Math.max(0, itemCount) * itemWidth + axisSpace;

  useEffect(() => {
    const node = viewport.current;
    const content = canvas.current;
    if (!node || !content) return;
    const update = () => {
      const max = Math.max(0, node.scrollWidth - node.clientWidth);
      const value = {
        overflow: max > 2,
        previous: node.scrollLeft > 2,
        next: node.scrollLeft < max - 2,
        offset: Math.max(0, Math.min(max, node.scrollLeft)),
        max,
        thumb: Math.max(
          40,
          Math.min(
            180,
            (node.clientWidth * node.clientWidth) / node.scrollWidth,
          ),
        ),
      };
      setPosition((before) =>
        before.overflow === value.overflow &&
        before.previous === value.previous &&
        before.next === value.next &&
        before.offset === value.offset &&
        before.max === value.max &&
        before.thumb === value.thumb
          ? before
          : value,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    observer.observe(content);
    node.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", update);
    };
  }, []);

  function move(direction: number) {
    const node = viewport.current;
    if (!node) return;
    node.scrollBy({
      left: direction * node.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  return (
    <div className="scrollable-chart">
      {position.overflow && (
        <div className="scrollable-chart__tools">
          <p id={hint}>Deslizá la barra inferior para ver todos los datos.</p>
          <div className="scrollable-chart__arrows">
            <button
              type="button"
              disabled={!position.previous}
              aria-label={`Desplazar ${label} a la izquierda`}
              onClick={() => move(-1)}
            >
              <Icon
                name="chevron"
                size={16}
                style={{ transform: "rotate(180deg)" }}
              />
            </button>
            <button
              type="button"
              disabled={!position.next}
              aria-label={`Desplazar ${label} a la derecha`}
              onClick={() => move(1)}
            >
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </div>
      )}
      <div
        ref={viewport}
        className="scrollable-chart__viewport"
        role="region"
        aria-label={label}
        aria-describedby={position.overflow ? hint : undefined}
        tabIndex={position.overflow ? 0 : -1}
      >
        <div
          ref={canvas}
          className="scrollable-chart__canvas"
          style={{ minWidth, height }}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {children}
          </ResponsiveContainer>
        </div>
      </div>
      {position.overflow && (
        <div className="scrollable-chart__slider">
          <input
            type="range"
            min={0}
            max={position.max}
            step={1}
            value={position.offset}
            aria-label={`Desplazamiento horizontal de ${label}`}
            aria-valuetext={`${Math.round((position.offset / position.max) * 100)}% del recorrido`}
            style={
              {
                "--chart-scroll-thumb": `${position.thumb}px`,
              } as CSSProperties
            }
            onChange={(event) => {
              const offset = Number(event.target.value);
              if (viewport.current) viewport.current.scrollLeft = offset;
              setPosition((before) => ({
                ...before,
                offset,
                previous: offset > 2,
                next: offset < before.max - 2,
              }));
            }}
          />
        </div>
      )}
    </div>
  );
}
