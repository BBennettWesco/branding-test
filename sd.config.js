import StyleDictionary from 'style-dictionary';
import { parse, oklch, formatCss } from 'culori';
import { formats, transformGroups } from 'style-dictionary/enums';

// 1. Define the custom Culori color transform
StyleDictionary.registerTransform({
  name: 'color/culori-oklch',
  type: 'value',
  transitive: true,
  // Match tokens that are identified as colors
  matcher: (token) => token.$type === 'color' || token.type === 'color',
  // Use Culori to parse and output into standard OKLCH format
  transformer: (token) => {
    const parsedColor = parse(token.$value || token.value);
    if (!parsedColor) return token.value; // Fallback if unparseable
    
    // Convert to OKLCH and format as standard CSS
    return formatCss(oklch(parsedColor));
  }
});

//const { androidColors, androidDimens, androidFontDimens, iosMacros, scssVariables } = formats;
const { css } = transformGroups;

// HAVE THE STYLE DICTIONARY CONFIG DYNAMICALLY GENERATED
function getStyleDictionaryConfig(brand, platform) {
  return {
    source: [
      `tokens/brands/${brand}/*.json`,
      'tokens/*.json',
      `tokens/platforms/${platform}/*.json`,
    ],
    platforms: {
      css: {
        // Append our custom Culori transform to standard CSS setups
        transforms: ['name/kebab', 'color/culori-oklch'],
        transformGroup: css,
        buildPath: `build/css/`,
        files: [
          {
            destination: '*.css',
            "format": "css/variables"
          },
        ],
      },
      /*android: {
        transformGroup: 'android',
        buildPath: `build/android/${brand}/`,
        files: [
          {
            destination: 'tokens.colors.xml',
            format: androidColors,
          },
          {
            destination: 'tokens.dimens.xml',
            format: androidDimens,
          },
          {
            destination: 'tokens.font_dimens.xml',
            format: androidFontDimens,
          },
        ],
      },
      ios: {
        transformGroup: 'ios',
        buildPath: `build/ios/${brand}/`,
        files: [
          {
            destination: 'tokens.h',
            format: iosMacros,
          },
        ],
      },*/
    }
  };
}

console.log('Build started...');

// PROCESS THE DESIGN TOKENS FOR THE DIFFERENT BRANDS AND PLATFORMS

['synergy', 'wesco',].map(function (brand) {
  ['css'].map(function (platform) {
    console.log('\n==============================================');
    console.log(`\nProcessing: [${platform}] [${brand}]`);

    const sd = new StyleDictionary(getStyleDictionaryConfig(brand, platform));
    sd.buildPlatform(platform);
  });
});

console.log('\n==============================================');
console.log('\nBuild completed!');
