import fs from "fs";
import path from "path";

const INPUT = "./tokens/raw/figma.json";
const OUTPUT = "./tokens";

const figma = JSON.parse(
  fs.readFileSync(INPUT, "utf8")
);

const collections =
  figma.meta.variableCollections || {};

const variables =
  figma.meta.variables || {};

const COLLECTION_TYPES = {
  // Brands
  synergy: "brand",
  wesco: "brand",
  //anixter: "brand",
  //eecol: "brand",
  //accutech: "brand",
  //xpressconnect: "brand",
  //tvc: "brand",

  // Styles
  neutral: "style",
  brand: "style",
  red: "style",
  orange: "style",
  yellow: "style",
  green: "style",
  teal: "style",
  blue: "style",
};

/* ----------------------------------
 * Helpers
 * ---------------------------------- */

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  mkdir(path.dirname(file));

  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  );
}

function slug(str) {
  return str
    .replace(/^(\d+\.\s*)/, "")
    .replace(/["']/g, "")
    .replace(/=/g, "-")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/*function rgbaToHex(color) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  if (color.a !== undefined && color.a < 1) {
    const a = Math.round(color.a * 255);

    return (
      "#" +
      [r, g, b, a]
        .map((v) =>
          v.toString(16).padStart(2, "0")
        )
        .join("")
        .toUpperCase()
    );
  }

  return (
    "#" +
    [r, g, b]
      .map((v) =>
        v.toString(16).padStart(2, "0")
      )
      .join("")
      .toUpperCase()
  );
}*/

function tokenPath(name) {
  return name
    .replace(/"/g, "")
    .replace(/\./g, "/")
    .split("/")
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
    );
}

function setDeep(obj, pathArray, value) {
  let current = obj;

  pathArray.forEach((segment, index) => {
    if (index === pathArray.length - 1) {
      current[segment] = value;
      return;
    }

    current[segment] ??= {};
    current = current[segment];
  });
}

/* ----------------------------------
 * Collection Lookup
 * ---------------------------------- */

const collectionLookup = {};

Object.values(collections).forEach(
  (collection) => {
    collectionLookup[collection.id] =
      collection;
  }
);

/* ----------------------------------
 * Variable Lookup
 * ---------------------------------- */

const variableLookup = {};

Object.values(variables).forEach(
  (variable) => {
    variableLookup[variable.id] =
      variable;
  }
);

/* ----------------------------------
 * Output Containers
 * ---------------------------------- */

const outputs = {};

function ensureOutput(
  collectionName,
  category
) {
  outputs[collectionName] ??= {};

  outputs[collectionName][category] ??=
    {};

  return outputs[collectionName][category];
}

/* ----------------------------------
 * Convert Variable
 * ---------------------------------- */

function convertValue(value) {
  if (
    value &&
    typeof value === "object" &&
    value.type === "VARIABLE_ALIAS"
  ) {
    const target =
      variableLookup[value.id];

    if (!target) {
      return null;
    }

    return `{${tokenPath(
      target.name
    ).join(".")}}`;
  }

  /*if (
    value &&
    typeof value === "object" &&
    "r" in value
  ) {
    return rgbaToHex(value);
  }*/

  return value;
}

/* ----------------------------------
 * Determine Category
 * ---------------------------------- */

function getCategory(variable) {
  const name =
    variable.name.toLowerCase();

  if (name.includes("color"))
    return "color";

  if (name.includes("spacing"))
    return "spacing";

  if (
    name.includes("radius") ||
    name.includes("corner")
  )
    return "radius";

  if (
    name.includes("border") ||
    name.includes("stroke")
  )
    return "border";

  return "typography";
}

/* ----------------------------------
 * Process Base Collections
 * ---------------------------------- */

Object.values(variables).forEach(
  (variable) => {
    const collection =
      collectionLookup[
        variable.variableCollectionId
      ];

    if (!collection) return;

    if (collection.isExtension)
      return;

    const category =
      getCategory(variable);

    const root =
      ensureOutput(
        slug(collection.name),
        category
      );

    const modeId =
      collection.defaultModeId;

    const value =
      variable.valuesByMode[
        modeId
      ];

    if (value === undefined) return;

    setDeep(
      root,
      tokenPath(variable.name),
      {
        value:
          convertValue(value)
      }
    );
  }
);

/* ----------------------------------
 * Process Extensions
 * ---------------------------------- */

Object.values(collections).forEach(
  (collection) => {
    if (!collection.isExtension)
      return;

    const overrides =
      collection.variableOverrides ||
      {};

    Object.entries(overrides).forEach(
      ([variableId, values]) => {
        const variable =
          variableLookup[
            variableId
          ];

        if (!variable) return;

        const category =
          getCategory(variable);

        const root =
          ensureOutput(
            slug(collection.name),
            category
          );

        const modeId =
          collection.defaultModeId;

        const value =
          values[modeId];

        if (value === undefined)
          return;

        setDeep(
          root,
          tokenPath(variable.name),
          {
            value:
              convertValue(
                value
              )
          }
        );
      }
    );
  }
);

/* ----------------------------------
 * Metadata
 * ---------------------------------- */

const metadata = {};

Object.values(collections).forEach(
  (collection) => {
    metadata[
      slug(collection.name)
    ] = {
      extends:
        collection
          .baseCollectionId
          ? slug(
              collectionLookup[
                collection
                  .baseCollectionId
              ]?.name ||
                ""
            )
          : null,
    };
  }
);

/* ----------------------------------
 * Write Files
 * ---------------------------------- */

Object.entries(outputs).forEach(
  ([collectionName, categories]) => {
    const collectionType =
  COLLECTION_TYPES[collectionName];

if (!collectionType) {
  console.warn(
    `Unknown collection type for "${collectionName}"`
  );
  return;
}

const baseDir =
  collectionType === "style"
    ? `style/${collectionName}`
    : `brands/${collectionName}`;

    Object.entries(categories).forEach(
      ([category, tokens]) => {
        writeJson(
          `${OUTPUT}/${baseDir}/${category}.json`,
          tokens
        );
      }
    );
  }
);

writeJson(
  `${OUTPUT}/metadata/collections.json`,
  metadata
);

console.log(
  "✓ Tokens transformed successfully"
);