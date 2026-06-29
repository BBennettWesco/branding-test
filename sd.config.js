import fs from "node:fs";
import StyleDictionary from "style-dictionary";
import { parse, oklch, formatCss } from "culori";

const ROOT = process.cwd();

//////////////////////////////////////////////////////
// Helpers
//////////////////////////////////////////////////////

function getFolders(root) {
  return fs.readdirSync(`${ROOT}/${root}`, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

//////////////////////////////////////////////////////
// Transform: color → OKLCH
//////////////////////////////////////////////////////

StyleDictionary.registerTransform({
  name: "color/culori-oklch",
  type: "value",
  transitive: true,
  filter: (token) =>
    token.$type === "color" || token.type === "color",
  transform: (token) => {
    const raw = token.$value ?? token.value;
    if (
      raw &&
      typeof raw === "object" &&
      "r" in raw
    ) {
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
// Formatter
//////////////////////////////////////////////////////

StyleDictionary.registerFormat({
  name: "css/theme",
  format({ dictionary, options }) {
    const lines = [];
    lines.push(`${options.selector} {`);

    for (const token of dictionary.allTokens) {
      const value = token.$value ?? token.value;

      lines.push(`  --${token.name}: ${value};`);
    }

    lines.push("}");
    return lines.join("\n");
  },
});

//////////////////////////////////////////////////////
// Platforms
//////////////////////////////////////////////////////

const platforms = {};

//////////////////////////////////////////////////////
// BRANDS
//////////////////////////////////////////////////////

for (const brand of getFolders("tokens/brands")) {

  console.log("Building brand:", brand);

  const sd = new StyleDictionary({
    log: {verbosity: "verbose"},
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
            },

            filter: (token) => {
              const file = token.filePath.replaceAll("\\", "/");
              return file.includes(`tokens/brands/${brand}/`);
            }
          },
        ],
      },
    },
  });

  await sd.buildAllPlatforms();
}

//////////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////////

for (const style of getFolders("tokens/style")) {

  console.log("Building style:", style);

  const sd = new StyleDictionary({
    log: {verbosity: "verbose"},
    include: [
      "tokens/brands/**/*.json"
    ],

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
            format: "css/variables",
            options: {
              selector: `[data-style="${style}"]`,
              outputReferences: true,
            },

            filter: (token) => {
              const file = token.filePath.replaceAll("\\", "/");
              return file.includes(`tokens/style/${style}/`);
            }
          }
        ]
      }
    }
  });

  await sd.buildAllPlatforms();
}

//////////////////////////////////////////////////////
// BUILD
//////////////////////////////////////////////////////

const sd = new StyleDictionary({
  platforms,
});

await sd.buildAllPlatforms();

console.log("✓ CSS tokens built");