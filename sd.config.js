import fs from "node:fs";
import StyleDictionary from "style-dictionary";
import { parse, oklch, formatCss } from "culori";

const ROOT = process.cwd();
const BASE_BRAND = "synergy";
const BASE_STYLE = "neutral";

const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong"
]);

const FONT_FAMILY_FALLBACK_OVERRIDES = new Map([
  ["source sans 3", ["Segoe UI", "Arial", "sans-serif"]],
  ["titillium web", ["Segoe UI", "Arial", "sans-serif"]],
  ["source code pro", ["Cascadia Code", "SFMono-Regular", "Consolas", "monospace"]]
]);

const SERIF_HINTS = [
  "serif",
  "times",
  "georgia",
  "garamond",
  "merriweather",
  "playfair"
];

const MONO_HINTS = [
  "mono",
  "code",
  "console",
  "courier",
  "menlo",
  "inconsolata",
  "jetbrains"
];

//////////////////////////////////////////////////////
// Helpers
//////////////////////////////////////////////////////

function getFolders(root) {
  return fs
    .readdirSync(`${ROOT}/${root}`, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function normalizeFontPart(part) {
  return part.trim().replace(/^['"]|['"]$/g, "");
}

function formatFontPart(part) {
  const normalized = normalizeFontPart(part);
  const lower = normalized.toLowerCase();

  if (
    GENERIC_FONT_FAMILIES.has(lower) ||
    normalized.startsWith("var(") ||
    normalized.startsWith("env(")
  ) {
    return normalized;
  }

  return `"${normalized.replaceAll('"', '\\"')}"`;
}

function formatFontFamilyValue(raw) {
  const parts = raw
    .split(",")
    .map((part) => normalizeFontPart(part))
    .filter(Boolean);

  if (!parts.length) return raw;

  const normalizedSet = new Set(parts.map((part) => part.toLowerCase()));
  const hasGenericFallback = parts.some((part) =>
    GENERIC_FONT_FAMILIES.has(part.toLowerCase())
  );

  if (!hasGenericFallback) {
    const primary = parts[0].toLowerCase();
    const fallbackParts =
      FONT_FAMILY_FALLBACK_OVERRIDES.get(primary) ?? getDefaultFallbackStack(primary);

    for (const fallbackPart of fallbackParts) {
      const lowerFallback = fallbackPart.toLowerCase();
      if (!normalizedSet.has(lowerFallback)) {
        parts.push(fallbackPart);
        normalizedSet.add(lowerFallback);
      }
    }
  }

  return parts.map(formatFontPart).join(", ");
}

function getDefaultFallbackStack(primary) {
  if (MONO_HINTS.some((hint) => primary.includes(hint))) {
    return ["Cascadia Code", "SFMono-Regular", "Consolas", "monospace"];
  }

  if (SERIF_HINTS.some((hint) => primary.includes(hint))) {
    return ["Georgia", "Times New Roman", "serif"];
  }

  return ["Segoe UI", "Arial", "sans-serif"];
}

//////////////////////////////////////////////////////
// Transform: color → OKLCH
//////////////////////////////////////////////////////

StyleDictionary.registerTransform({
  name: "color/culori-oklch",
  type: "value",
  transitive: false,
  filter: (token) =>
    token.$type === "color" || token.type === "color",
  transform: (token) => {
    const raw = token.$value ?? token.value;

    if (raw && typeof raw === "object" && "r" in raw) {
      return formatCss(
        oklch({
          mode: "rgb",
          r: raw.r,
          g: raw.g,
          b: raw.b,
          alpha: raw.a
        })
      );
    }

    const parsed = parse(raw);
    if (!parsed) return raw;

    return formatCss(oklch(parsed));
  }
});

//////////////////////////////////////////////////////
// Transform: font family → quoted + fallback stack
//////////////////////////////////////////////////////

StyleDictionary.registerTransform({
  name: "fontFamily/quoted-fallback",
  type: "value",
  transitive: false,
  filter: (token) =>
    token.$type === "fontFamily" || token.type === "fontFamily",
  transform: (token) => {
    const raw = token.$value ?? token.value;
    if (typeof raw !== "string") return raw;

    // Keep references intact so outputReferences can still render CSS vars.
    if (raw.includes("{")) return raw;

    return formatFontFamilyValue(raw);
  }
});

//////////////////////////////////////////////////////
// Transform group
//////////////////////////////////////////////////////

StyleDictionary.registerTransformGroup({
  name: "custom/css",
  transforms: [
    "attribute/cti",
    "name/kebab",
    "color/culori-oklch",
    "fontFamily/quoted-fallback",
  ],
});

//////////////////////////////////////////////////////
// Custom style formatter
//////////////////////////////////////////////////////

StyleDictionary.registerFormat({
  name: "css/style-theme",
  format({ dictionary, options }) {
    const lines = [];
    const pathToName = new Map(
      dictionary.allTokens.map((t) => [t.path.join("."), t.name])
    );
    const toCssVar = (refPath) => {
      const refName =
        pathToName.get(refPath) ??
        refPath
          .replaceAll(".", "-")
          .replace(/[^a-zA-Z0-9-_]/g, "");
      return `var(--${refName})`;
    };

    lines.push(`${options.selector} {`);

    for (const token of dictionary.allTokens) {

      const file = token.filePath.replaceAll("\\", "/");

      // IMPORTANT: styles ONLY emit style tokens
      if (file.includes("tokens/brands/")) continue;

      const resolvedValue = token.value ?? token.$value;
      const referenceValue = [
        token.original?.$value,
        token.original?.value,
        token.$value,
        token.value,
      ].find((v) => typeof v === "string" && v.includes("{"));

      // Preserve semantic aliases as CSS variables when outputReferences is enabled.
      const value =
        options.outputReferences && typeof referenceValue === "string"
          ? referenceValue.replace(/\{([^}]+)\}/g, (_match, refPath) => {
              return toCssVar(refPath);
            })
          : resolvedValue;

      lines.push(`  --${token.name}: ${value};`);
    }

    lines.push("}");

    return lines.join("\n");
  }
});

//////////////////////////////////////////////////////
// BRANDS BUILD
//////////////////////////////////////////////////////

for (const brand of getFolders("tokens/brands")) {

  console.log("Building brand:", brand);

  const sd = new StyleDictionary({
    log: { verbosity: "verbose" },
    source: [`tokens/brands/${brand}/**/*.json`],

    platforms: {
      css: {
        transformGroup: "custom/css",
        buildPath: "build/css/",
        files: [
          {
            destination: `brands/${brand}.css`,
            format: "css/variables",
            options: {
              selector: `[data-brand="${brand}"]`,
              outputReferences: true
            }
          }
        ]
      }
    }
  });

  await sd.buildAllPlatforms();
}

//////////////////////////////////////////////////////
// STYLES BUILD
//////////////////////////////////////////////////////

for (const style of getFolders("tokens/style")) {

  console.log("Building style:", style);

  const sd = new StyleDictionary({
    log: { verbosity: "verbose" },

    // IMPORTANT: only ONE canonical brand for reference resolution
    include: [`tokens/brands/${BASE_BRAND}/**/*.json`],

    source: [
      `tokens/style/${style}/**/*.json`
    ],

    platforms: {
      css: {
        transformGroup: "custom/css",
        buildPath: "build/css/",
        files: [
          {
            destination: `style/${style}.css`,
            format: "css/style-theme",
            options: {
              selector: `[data-style="${style}"]`,
              outputReferences: true
            }
          }
        ]
      }
    }
  });

  await sd.buildAllPlatforms();
}

console.log("✓ CSS tokens built");