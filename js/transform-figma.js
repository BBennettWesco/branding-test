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

/**
 * Converts Figma name → flat token key
 * "brand/color/primary/0" → "brand-color-primary-0"
 */
function tokenKey(name) {
  return name
    .replace(/"/g, "")
    .replace(/\./g, "/")
    .split("/")
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
    )
    .join("-");
}

function rgbaToHex(color) {
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
}

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

/*function setDeep(obj, pathArray, value) {
  let current = obj;

  pathArray.forEach((segment, index) => {
    if (index === pathArray.length - 1) {
      current[segment] = value;
      return;
    }

    current[segment] ??= {};
    current = current[segment];
  });
}*/

function getRootCollection(collection) {
  let current = collection;

  while (
    current?.isExtension &&
    current?.baseCollectionId
  ) {
    current =
      collectionLookup[
        current.baseCollectionId
      ];
  }

  return current;
}

function getCollectionGroup(collection) {
  const root =
    getRootCollection(collection);

  if (!root) {
    return null;
  }

  const rootName =
    root.name.toLowerCase();

  // Brand root
  if (rootName.includes("global")) {
    return "brand";
  }

  // Style root
  if (rootName.includes("style")) {
    return "style";
  }

  return null;
}

function getOutputFolder(collection) {
  const match =
    collection.name.match(
      /=["']?([^"']+)["']?/
    );

  if (match) {
    return match[1]
      .trim()
      .toLowerCase();
  }

  return collection.name
    .toLowerCase()
    .replace(/"/g, "")
    .trim();
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
  collectionId,
  category
) {
  outputs[collectionId] ??= {};

  outputs[collectionId][category] ??= {};

  return outputs[collectionId][category];
}

/* ----------------------------------
 * Convert Variable
 * ---------------------------------- */

function getTokenType(variable) {
  switch (variable.resolvedType) {
    case "COLOR":
      return "color";

    case "FLOAT":
      return "dimension";

    case "STRING":
      return "fontFamily";

    case "BOOLEAN":
      return "boolean";

    default:
      return "string";
  }
}

function convertValue(
  value,
  variable
) {

  if (
    value &&
    typeof value === "object" &&
    value.type === "VARIABLE_ALIAS"
  ) {
    const target =
      variableLookup[value.id];

    if (!target) return null;

    return `{${tokenPath(
      target.name
    ).join("-")}}`;
  }

  if (
    value &&
    typeof value === "object" &&
    "r" in value
  ) {
    return rgbaToHex(value);
  }

  if (
    variable.resolvedType === "FLOAT"
  ) {

    const name =
      variable.name.toLowerCase();

    // Font weight
    if (
      name.includes("/fw")
    ) {
      return value;
    }

    return `${value}px`;
  }

  return value;
}

/* ----------------------------------
 * Determine Category
 * ---------------------------------- */

function getCategory(variable) {
  const name =
    variable.name.toLowerCase();

  if (
    variable.resolvedType === "COLOR"
  ) {
    return "color";
  }

  if (name.includes("text") && variable.resolvedType !== "COLOR") 
    return "typography";

  if (name.includes("spacing"))
    return "spacing";

  if (
    name.includes("radius") ||
    name.includes("corner") ||
    name.includes("rounded")
  )
    return "radius";

  if (
    name.includes("border-width") ||
    name.includes("stroke") && variable.resolvedType !== "COLOR"
  )
    return "border";

  if (
    name.includes("shadow")
  ) {
    return "shadow";
  }

if (
    name.includes("grid") ||
    name.includes("container") ||
    name === "width"
  ) {
    return "layout";
  }

  return null;
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
      
    if (!category)
      return;

    const root =
      ensureOutput(
        collection.id,
        category
      );

    const modeId =
      collection.defaultModeId;

    const value =
      variable.valuesByMode[
        modeId
      ];

    if (value === undefined) return;

    const key = tokenPath(variable.name)
  .join("-");

    root[key] = {
      $value: convertValue(value, variable),
      $type: getTokenType(variable),
    };
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
            collection.id,
            category
          );

        const modeId =
          collection.defaultModeId;

        const value =
          values[modeId];

        if (value === undefined)
          return;

        const key = tokenPath(variable.name)
  .join("-");

        root[key] = {
          $value: convertValue(value, variable),
          $type: getTokenType(variable),
        };
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
    metadata[collection.id] = {
      name: collection.name,

      extends:
        collection.baseCollectionId || null,
    };
  }
);

/* ----------------------------------
 * Write Files
 * ---------------------------------- */

Object.entries(outputs).forEach(
  ([collectionId, categories]) => {

    const collection =
      collectionLookup[
        collectionId
      ];

    if (!collection) {
      console.warn(
        `Collection not found for "${collectionId}"`
      );
      return;
    }

    const group =
      getCollectionGroup(collection);

    if (!group) {
      console.warn(
        `Skipping collection "${collection.name}"`
      );
      return;
    }

    const folder =
      getOutputFolder(collection);

    const baseDir =
      group === "brand"
        ? `brands/${folder}`
        : `style/${folder}`;

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