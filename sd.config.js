import fs from "node:fs";
import StyleDictionary from "style-dictionary";
import { parse, oklch, formatCss } from "culori";

const ROOT = process.cwd();
const BASE_BRAND = "synergy";
const BASE_STYLE = "neutral";

//////////////////////////////////////////////////////
// Helpers
//////////////////////////////////////////////////////

function getFolders(root) {
  return fs
    .readdirSync(`${ROOT}/${root}`, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
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
// Transform group
//////////////////////////////////////////////////////

StyleDictionary.registerTransformGroup({
  name: "custom/css",
  transforms: [
    "attribute/cti",
    "name/kebab",
    "color/culori-oklch",
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