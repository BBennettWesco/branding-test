import fs from "node:fs";
import StyleDictionary from 'style-dictionary';
import { parse, oklch, formatCss } from 'culori';

//////////////////////////////////////////////////////
// Helpers
//////////////////////////////////////////////////////

function getFolders(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

//////////////////////////////////////////////////////
// Transform colors to oklch
//////////////////////////////////////////////////////
StyleDictionary.registerTransform({
  name: 'color/culori-oklch',
  type: 'value',
  transitive: true,
  filter: (token) => {
    return (
      token.$type === "color" ||
      token.type === "color" ||
      token.attributes?.category === "color"
    );
  },
  transform: (token) => {
    const raw = token.$value ?? token.value;
    const parsedColor = parse(raw);
    if (!parsedColor) {return raw;}

    return formatCss(oklch(parsedColor));
  },
});

//////////////////////////////////////////////////////
// Transform Group
//////////////////////////////////////////////////////

StyleDictionary.registerTransformGroup({

  name: "custom/css",

  transforms: [
    "attribute/cti",
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

      const value =
        token.value ??
        token.$value;

      const cssValue =
        typeof value === "string" &&
        value.startsWith("{")
          ? `var(--${value
              .slice(1, -1)
              .replace(/\./g, "-")})`
          : value;

      lines.push(
        `  --${token.name}: ${cssValue};`
      );
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
// Brands
//////////////////////////////////////////////////////

for (const brand of getFolders("tokens/brands")) {

  platforms[`css-brand-${brand}`] = {

    transformGroup: "custom/css",

    source: [
      `../tokens/brands/${brand}/**/*.json`,
    ],

    buildPath: "build/css/",

    files: [
      {
        destination: `brands/${brand}.css`,
        format: "css/theme",
        options: {
          selector: `[data-brand="${brand}"]`,
          outputReferences: true,
        },
      },
    ],
  };
}

//////////////////////////////////////////////////////
// Styles
//////////////////////////////////////////////////////

for (const style of getFolders("tokens/style")) {

  platforms[`css-style-${style}`] = {

    transformGroup: "custom/css",

    source: [
      `../tokens/style/${style}/**/*.json`,
    ],

    buildPath: "build/css/",

    files: [
      {
        destination: `style/${style}.css`,
        format: "css/theme",
        options: {
          selector: `[data-style="${style}"]`,
          outputReferences: true,
        },
      },
    ],
  };
}

//////////////////////////////////////////////////////
// Build
//////////////////////////////////////////////////////

const sd = new StyleDictionary({

  platforms,

});

await sd.buildAllPlatforms();

console.log("✓ CSS tokens built");

/*import { transformGroups } from 'style-dictionary/enums';

function quoteCssFontFamily(value) {
  if (typeof value !== 'string') return value;
  const name = value.trim();
  const isQuoted =
    (name.startsWith("'") && name.endsWith("'")) ||
    (name.startsWith('"') && name.endsWith('"'));
  if (isQuoted) return name;
  if (/\s/.test(name)) return `'${name.replace(/'/g, "\\'")}'`;
  return name;
}

function isFontFamilyToken(token) {
  const type = token.$type ?? token.type;
  if (type === 'fontFamily') return true;
  const scopes = token.$extensions?.['com.figma.scopes'];
  if (Array.isArray(scopes) && scopes.includes('FONT_FAMILY')) return true;
  const path = token.path?.join('.') ?? '';
  return path.endsWith('.ff') || path.endsWith('-ff');
}

// Figma exports font families as $type "string"; built-in fontFamily/css only matches "fontFamily"
StyleDictionary.registerTransform({
  name: 'fontFamily/figma-css',
  type: 'value',
  transitive: true,
  filter: isFontFamilyToken,
  transform: (token) => quoteCssFontFamily(token.$value ?? token.value),
});

const { css } = transformGroups;

function getStyleDictionaryConfig(brand, theme, platform) {
  return {
    source: [
      'tokens/*.json',
      `tokens/brands/${brand}/*.json`,
      `tokens/brands/${brand}.json`,
      `tokens/themes/${theme}/*.json`,
      `tokens/themes/${theme}.json`,
      `tokens/platforms/${platform}/*.json`,
    ],
    platforms: {
      css: {
        transforms: ['name/kebab', 'color/culori-oklch', 'fontFamily/figma-css'],
        transformGroup: css,
        buildPath: 'build/css/',
        files: [
          {
            destination: `${brand}.css`,
            format: 'css/variables',
            options: {
              selector: `[data-brand="${brand}"]`,
              outputReferences: true
            },
          },
        ],
      },
    },
  };
}

console.log('Build started...');

// Build brand-specific tokens
for (const brand of ['synergy', 'wesco']) {
  for (const platform of ['css']) {
    console.log('\n==============================================');
    console.log(`\nProcessing: [${platform}] [${brand}]`);

    const sd = new StyleDictionary(getStyleDictionaryConfig(brand, platform));
    await sd.buildPlatform(platform);
  }
}

console.log('\n==============================================');
console.log('\nBuild completed!');*/
