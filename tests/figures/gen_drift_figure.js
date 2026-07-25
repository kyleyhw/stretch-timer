/**
 * @file Generates tests/reports/figures/timer-drift.svg — a line chart comparing the displayed
 * remaining time of a naive per-tick decrement countdown against the drift-free timestamp
 * countdown, plotted over true elapsed time, using the shared simulateDrift model.
 *
 * Dependency-free: the SVG is assembled as a string. Run with: node tests/figures/gen_drift_figure.js
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateDrift } from './drift-model.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../reports/figures/timer-drift.svg');

const series = simulateDrift();

// --- chart geometry (px) ---
const W = 760;
const H = 440;
const ML = 66; // left margin (y axis + labels)
const MR = 176; // right margin (legend)
const MT = 56; // top margin (title)
const MB = 58; // bottom margin (x axis + labels)
const plotW = W - ML - MR;
const plotH = H - MT - MB;

const xs = series.elapsedRealMs.map((ms) => ms / 1000); // true elapsed seconds
const xMax = Math.max(...xs);
const yMax = 300; // duration seconds

/** @param {number} x @returns {number} */
const sx = (x) => ML + (x / xMax) * plotW;
/** @param {number} y @returns {number} */
const sy = (y) => MT + plotH - (Math.max(0, Math.min(yMax, y)) / yMax) * plotH;

/**
 * @param {number[]} xv seconds
 * @param {number[]} yv seconds
 * @returns {string}
 */
const points = (xv, yv) =>
  xv.map((x, i) => `${sx(x).toFixed(1)},${sy(yv[i]).toFixed(1)}`).join(' ');

const trueSec = series.trueRemainingMs.map((ms) => ms / 1000);
const naiveSec = series.naiveRemainingMs.map((ms) => ms / 1000);
const tsSec = series.tsRemainingMs.map((ms) => ms / 1000);

// --- axis ticks every 60 s ---
/** @type {string[]} */
const gridParts = [];
for (let v = 0; v <= 300; v += 60) {
  const y = sy(v);
  gridParts.push(
    `<line x1="${ML}" y1="${y.toFixed(1)}" x2="${ML + plotW}" y2="${y.toFixed(1)}" class="grid"/>`,
    `<text x="${ML - 10}" y="${(y + 4).toFixed(1)}" class="tick" text-anchor="end">${v}</text>`,
  );
  const x = sx(v);
  gridParts.push(
    `<text x="${x.toFixed(1)}" y="${MT + plotH + 20}" class="tick" text-anchor="middle">${v}</text>`,
  );
}

const legendX = ML + plotW + 22;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="title desc">
  <title id="title">Countdown drift: naive decrement vs. drift-free timestamp</title>
  <desc id="desc">Over 300 seconds of true elapsed time, the drift-free timestamp countdown stays on the true-remaining line, while the naive per-tick decrement countdown drifts above it and still shows about three seconds remaining when the hold should already have ended.</desc>
  <style>
    .bg { fill: #ffffff; }
    .grid { stroke: #e5e7eb; stroke-width: 1; }
    .axis { stroke: #9ca3af; stroke-width: 1; }
    .tick { fill: #6b7280; font: 12px system-ui, sans-serif; }
    .lbl { fill: #374151; font: 13px system-ui, sans-serif; }
    .ttl { fill: #111827; font: 600 16px system-ui, sans-serif; }
    .leg { fill: #374151; font: 12px system-ui, sans-serif; }
    .true { fill: none; stroke: #9ca3af; stroke-width: 6; opacity: 0.5; }
    .ts { fill: none; stroke: #2563eb; stroke-width: 2; }
    .naive { fill: none; stroke: #dc2626; stroke-width: 2; stroke-dasharray: 6 4; }
  </style>
  <rect class="bg" x="0" y="0" width="${W}" height="${H}"/>
  <text class="ttl" x="${ML}" y="30">Countdown drift under jittery scheduling (D = 300 s)</text>
  ${gridParts.join('\n  ')}
  <line class="axis" x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + plotH}"/>
  <line class="axis" x1="${ML}" y1="${MT + plotH}" x2="${ML + plotW}" y2="${MT + plotH}"/>
  <polyline class="true" points="${points(xs, trueSec)}"/>
  <polyline class="naive" points="${points(xs, naiveSec)}"/>
  <polyline class="ts" points="${points(xs, tsSec)}"/>
  <text class="lbl" x="${ML + plotW / 2}" y="${H - 16}" text-anchor="middle">True elapsed time (s)</text>
  <text class="lbl" transform="translate(18 ${MT + plotH / 2}) rotate(-90)" text-anchor="middle">Displayed remaining (s)</text>
  <g>
    <line x1="${legendX}" y1="${MT + 6}" x2="${legendX + 28}" y2="${MT + 6}" class="true"/>
    <text class="leg" x="${legendX + 36}" y="${MT + 10}">True remaining</text>
    <line x1="${legendX}" y1="${MT + 30}" x2="${legendX + 28}" y2="${MT + 30}" class="ts"/>
    <text class="leg" x="${legendX + 36}" y="${MT + 34}">Drift-free (timestamp)</text>
    <line x1="${legendX}" y1="${MT + 54}" x2="${legendX + 28}" y2="${MT + 54}" class="naive"/>
    <text class="leg" x="${legendX + 36}" y="${MT + 58}">Naive decrement</text>
    <text class="leg" x="${legendX}" y="${MT + 92}" style="fill:#6b7280">At t = 300 s the naive</text>
    <text class="leg" x="${legendX}" y="${MT + 108}" style="fill:#6b7280">timer still reads ~3 s.</text>
  </g>
</svg>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, svg);
const finalDriftSec = ((series.naiveAbsErrorMs.at(-1) ?? 0) / 1000).toFixed(2);
console.log(`wrote ${outPath}`);
console.log(`final naive drift: ${finalDriftSec} s`);
