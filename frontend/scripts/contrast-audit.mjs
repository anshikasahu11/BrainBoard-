// A colour contrast audit computed from YOUR real colours. It reads frontend/app/globals.css,
// works out the WCAG contrast ratio for every text colour on every surface (plus buttons and the
// notification badge), and for anything that fails, suggests the smallest change that passes.
// It needs no servers and changes nothing.
//
// What the numbers mean (WCAG 2.2):  normal text needs 4.5 : 1,  large text and interface parts
// (focus rings, icons, the badge) need 3 : 1.
//
// It measures SOLID surfaces. The glowing ribbons behind the glass can lighten what text sits on,
// depending on where on the screen it is, so look at the brightest corner with your own eyes too.
//
// Run it from the frontend folder:
//   node scripts/contrast-audit.mjs            (one line per colour)
//   node scripts/contrast-audit.mjs --verbose  (every pair)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const verbose = process.argv.includes("--verbose");
const cssPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "globals.css");

if (!fs.existsSync(cssPath)) {
  console.error(`Couldn't find ${cssPath}. Run this from the frontend folder.`);
  process.exit(1);
}
const css = fs.readFileSync(cssPath, "utf8");

// ---------- Colour maths (WCAG 2.x) ----------
function hex(value) {
  let h = String(value).replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const toHex = (rgb) =>
  `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

const channel = (v) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function toHsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h / 6, s, l];
}

function fromHsl([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const part = (t) => {
    const x = (t + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [part(h + 1 / 3) * 255, part(h) * 255, part(h - 1 / 3) * 255];
}

// The smallest change in lightness that makes `fg` pass on ALL of `backgrounds`, or null.
function suggest(fg, backgrounds, needed) {
  const [h, s, l] = toHsl(fg);
  const average = backgrounds.reduce((sum, b) => sum + luminance(b), 0) / backgrounds.length;
  const lighter = luminance(fg) > average;

  for (let step = 1; step <= 200; step += 1) {
    const next = lighter ? l + step * 0.005 : l - step * 0.005;
    if (next < 0 || next > 1) break;

    const candidate = fromHsl([h, s, next]);
    if (Math.min(...backgrounds.map((b) => ratio(candidate, b))) >= needed) return toHex(candidate);
  }
  return null;
}

// ---------- Is the maths right? ----------
const calibration = [ratio([0, 0, 0], [255, 255, 255]), ratio(hex("#767676"), [255, 255, 255]), ratio(hex("#777777"), [255, 255, 255])];
if (!(Math.abs(calibration[0] - 21) < 0.01 && calibration[1] >= 4.5 && calibration[1] < 4.6 && calibration[2] < 4.5)) {
  console.error(`The contrast maths is wrong (${calibration.map((v) => v.toFixed(2)).join(", ")}). Tell me, and don't trust any number below.`);
  process.exit(1);
}
console.log(`The maths checks out: black on white is ${calibration[0].toFixed(1)}:1, and #767676 on white is ${calibration[1].toFixed(2)}:1 (the lightest grey that passes).\n`);

// ---------- Your colours ----------
const tokens = {};
for (const match of css.matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9a-f]{3}|#[0-9a-f]{6})\s*;/gi)) {
  if (!(match[1] in tokens)) tokens[match[1]] = hex(match[2]);
}

const SURFACES = ["void", "canvas", "sidebar", "card", "raised", "overlay", "code", "scorched"].filter((name) => tokens[name]);
const TEXT = ["fg", "fg-2", "fg-muted", "ember-300", "ember-400", "petrol-300", "gold", "sage", "amber", "success", "danger"];
const NEED_TEXT = 4.5;
const NEED_UI = 3;

console.log(`Found ${Object.keys(tokens).length} colours in globals.css. Surfaces measured: ${SURFACES.join(", ")}.\n`);

let passes = 0;
let fails = 0;
const missing = [];

function report(ok, text) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${text}`);
  if (ok) passes += 1;
  else fails += 1;
}

// ---------- 1. Text on surfaces ----------
console.log("--- Text colours on every surface (needs 4.5 : 1) ---");

for (const name of TEXT) {
  const fg = tokens[name];
  if (!fg) {
    missing.push(name);
    continue;
  }

  const results = SURFACES.map((surface) => ({ surface, value: ratio(fg, tokens[surface]) }));
  const worst = results.reduce((a, b) => (b.value < a.value ? b : a));
  const bad = results.filter((entry) => entry.value < NEED_TEXT);

  if (verbose) results.forEach((entry) => console.log(`        ${name} on ${entry.surface}: ${entry.value.toFixed(2)}:1`));

  if (bad.length === 0) {
    report(true, `${name.padEnd(11)} ${worst.value.toFixed(1)}:1 at its worst (on ${worst.surface})`);
  } else {
    const fix = suggest(fg, SURFACES.map((surface) => tokens[surface]), NEED_TEXT);
    report(
      false,
      `${name.padEnd(11)} ${worst.value.toFixed(1)}:1 on ${worst.surface}, below 4.5. Too low on: ${bad.map((entry) => entry.surface).join(", ")}. ${
        fix ? `Smallest fix: change ${toHex(fg)} to ${fix}` : "No small fix works: this colour needs rethinking"
      }`
    );
  }
}

// ---------- 2. Interface parts ----------
console.log("\n--- Interface parts (needs 3 : 1) ---");

for (const [name, what] of [["ember-300", "focus ring"], ["ember-500", "badge fill and unread dot"]]) {
  const fg = tokens[name];
  if (!fg) {
    missing.push(name);
    continue;
  }

  const results = SURFACES.map((surface) => ({ surface, value: ratio(fg, tokens[surface]) }));
  const worst = results.reduce((a, b) => (b.value < a.value ? b : a));
  report(worst.value >= NEED_UI, `${name} as the ${what}: ${worst.value.toFixed(1)}:1 at its worst (on ${worst.surface})`);
}

// ---------- 3. Buttons and the badge, read from the CSS ----------
console.log("\n--- Buttons and the badge (text on its fill, needs 4.5 : 1) ---");

function block(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : "";
}

function declaration(text, property) {
  const match = text.match(new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

function resolve(expression) {
  if (!expression) return null;
  const variable = expression.match(/var\(--color-([a-z0-9-]+)\)/);
  if (variable) return tokens[variable[1]] ?? null;
  const literal = expression.match(/#[0-9a-f]{3,6}\b/i);
  return literal ? hex(literal[0]) : null;
}

function component(label, selector, fillProperty = "background") {
  const text = block(selector);
  const fills = (declaration(text, fillProperty)?.match(/#[0-9a-f]{6}\b/gi) ?? []).map(hex);
  const variableFill = resolve(declaration(text, fillProperty));
  if (fills.length === 0 && variableFill) fills.push(variableFill);
  const fg = resolve(declaration(text, "color"));

  if (!text || !fg || fills.length === 0) {
    console.log(`SKIP  ${label}: couldn't read ${selector} from the CSS`);
    return;
  }

  const values = fills.map((fill) => ratio(fg, fill));
  const worst = Math.min(...values);
  const ok = worst >= NEED_TEXT;
  const fix = ok ? null : suggest(fg, fills, NEED_TEXT);

  report(ok, `${label}: ${values.map((value) => `${value.toFixed(1)}:1`).join(" and ")}${ok ? "" : `, below 4.5. ${fix ? `Smallest fix: change the text from ${toHex(fg)} to ${fix}` : "No small fix works"}`}`);
}

component("Primary button (text on its orange)", ".btn-primary");
component("Danger button (text on its dark red)", ".btn-danger");
component("Unread count on the bell", ".notif-badge");

// ---------- Summary ----------
if (missing.length > 0) console.log(`\nNot found in the CSS, so not measured: ${[...new Set(missing)].join(", ")}`);

console.log(`\n=== ${passes} passed, ${fails} failing ===`);
console.log("Solid surfaces only. Also look with your own eyes at the brightest corner of the page, where the orange ribbon sits behind text.");
process.exit(fails === 0 ? 0 : 1);