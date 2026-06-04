import StyleDictionary from 'style-dictionary';
import { parse, oklch, formatCss } from 'culori';
import { transformGroups } from 'style-dictionary/enums';

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

StyleDictionary.registerTransform({
  name: 'color/culori-oklch',
  type: 'value',
  transitive: true,
  filter: (token) => token.$type === 'color' || token.type === 'color',
  transform: (token) => {
    const raw = token.$value ?? token.value;
    const parsedColor = parse(raw);
    if (!parsedColor) return token.value;
    return formatCss(oklch(parsedColor));
  },
});

// Figma exports font families as $type "string"; built-in fontFamily/css only matches "fontFamily"
StyleDictionary.registerTransform({
  name: 'fontFamily/figma-css',
  type: 'value',
  transitive: true,
  filter: isFontFamilyToken,
  transform: (token) => quoteCssFontFamily(token.$value ?? token.value),
});

const { css } = transformGroups;

function getStyleDictionaryConfig(brand, platform) {
  return {
    source: [
      'tokens/core/*.json',
      'tokens/*.json',
      `tokens/brands/${brand}/*.json`,
      `tokens/brands/${brand}.json`,
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
              // This prevents Style Dictionary from flattening semantic aliases
              outputReferences: true
            },
          },
        ],
      },
    },
  };
}

console.log('Build started...');

for (const brand of ['synergy', 'wesco']) {
  for (const platform of ['css']) {
    console.log('\n==============================================');
    console.log(`\nProcessing: [${platform}] [${brand}]`);

    const sd = new StyleDictionary(getStyleDictionaryConfig(brand, platform));
    await sd.buildPlatform(platform);
  }
}

console.log('\n==============================================');
console.log('\nBuild completed!');
