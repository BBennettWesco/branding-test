import StyleDictionary from 'style-dictionary';
import { parse, oklch, formatCss } from 'culori';
import { transformGroups } from 'style-dictionary/enums';

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

const { css } = transformGroups;

function getStyleDictionaryConfig(brand, platform) {
  return {
    source: [
      `tokens/brands/${brand}/*.json`,
      `tokens/brands/${brand}.json`,
      'tokens/*.json',
      `tokens/platforms/${platform}/*.json`,
    ],
    platforms: {
      css: {
        transforms: ['name/kebab', 'color/culori-oklch'],
        transformGroup: css,
        buildPath: 'build/css/',
        files: [
          {
            destination: `${brand}.css`,
            format: 'css/variables',
            options: {
              selector: `[data-brand="${brand}"]`,
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
