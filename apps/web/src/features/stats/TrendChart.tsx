import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { TrendDay } from '@twiper/core';

interface TrendChartProps {
  days: readonly TrendDay[];
  /** 그릴 값. 그날 연습하지 않았으면 null */
  value: (day: TrendDay) => number | null;
  /** 축과 읽기 줄에 보일 값 (94%, 52) */
  format: (value: number) => string;
  /** 세로축 범위 */
  domain: readonly [number, number];
  /** 그래프 이름 (화면 읽기 프로그램) */
  label: string;
  /** 고른 날의 읽기 줄: 「11월 9일 · 94% · 12줄」. 연습하지 않은 날은 value가 null */
  readout: (day: TrendDay, value: string | null) => string;
  /** 축 아래 날짜 (11/9) */
  dateLabel: (day: string) => string;
}

const W = 320;
const H = 140;
const PAD = { left: 34, right: 10, top: 10, bottom: 22 };

/**
 * 날마다 값 하나를 꺾은선으로 그리는 작은 그래프. 연습하지 않은 날은 점이 없다.
 * 누르거나(포인터) 화살표 키로 날을 고르면 위 읽기 줄에 그날 값을 보인다. 같은 값은 숨긴 표에도 있다
 */
export function TrendChart({
  days,
  value,
  format,
  domain,
  label,
  readout,
  dateLabel,
}: TrendChartProps) {
  // 처음에는 마지막으로 연습한 날을 고른다
  const practiced = days.flatMap((day, i) => (value(day) === null ? [] : [i]));
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked ?? practiced[practiced.length - 1] ?? null;

  const [lo, hi] = domain;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = plotW / days.length;
  const xOf = (i: number) => PAD.left + step * (i + 0.5);
  const yOf = (v: number) => PAD.top + plotH * (1 - (v - lo) / (hi - lo || 1));
  const baseline = PAD.top + plotH;
  const ticks = [lo, (lo + hi) / 2, hi];

  const points = days.flatMap((day, i) => {
    const v = value(day);
    return v === null ? [] : [{ i, x: xOf(i), y: yOf(v) }];
  });
  const first = points[0];
  const last = points[points.length - 1];
  const path = points.map((p, n) => `${n === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area =
    first && last && points.length > 1
      ? `${path} L${last.x},${baseline} L${first.x},${baseline} Z`
      : '';

  const clamp = (i: number) => Math.max(0, Math.min(days.length - 1, i));
  const pickAt = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * W;
    setPicked(clamp(Math.floor((x - PAD.left) / step)));
  };
  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    const move = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (move === 0) return;
    event.preventDefault();
    setPicked(clamp((selected ?? days.length - 1) + move));
  };

  const day = selected === null ? undefined : days[selected];
  const dayValue = day ? value(day) : null;
  // 날짜 눈금: 처음·가운데·끝
  const dateTicks = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];

  return (
    <figure className="trend-chart">
      <p className="trend-readout" aria-live="polite">
        {day ? readout(day, dayValue === null ? null : format(dayValue)) : '\u{00A0}'}
      </p>
      <svg
        className="trend-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerDown={pickAt}
        onPointerMove={(event) => {
          if (event.buttons > 0 || event.pointerType === 'mouse') pickAt(event);
        }}
        onKeyDown={onKey}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="trend-grid"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yOf(tick)}
              y2={yOf(tick)}
            />
            <text
              className="trend-axis"
              x={PAD.left - 6}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {format(tick)}
            </text>
          </g>
        ))}
        {dateTicks.map((i) => {
          const tick = days[i];
          return tick ? (
            <text key={tick.day} className="trend-axis" x={xOf(i)} y={H - 6} textAnchor="middle">
              {dateLabel(tick.day)}
            </text>
          ) : null;
        })}
        {selected === null ? null : (
          <line
            className="trend-cross"
            x1={xOf(selected)}
            x2={xOf(selected)}
            y1={PAD.top}
            y2={baseline}
          />
        )}
        {area ? <path className="trend-area" d={area} /> : null}
        {points.length > 1 ? <path className="trend-line" d={path} /> : null}
        {points.map((p) => (
          <circle
            key={p.i}
            className={`trend-dot${p.i === selected ? ' is-selected' : ''}`}
            cx={p.x}
            cy={p.y}
            r={p.i === selected ? 5 : 4}
          />
        ))}
      </svg>
      <table className="visually-hidden">
        <caption>{label}</caption>
        <tbody>
          {days.map((row) => {
            const v = value(row);
            return (
              <tr key={row.day}>
                <th scope="row">{dateLabel(row.day)}</th>
                <td>{v === null ? '–' : format(v)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}
