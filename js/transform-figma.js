import fs from "fs";
import path from "path";

const INPUT = "./tokens/raw/figma.json";
const OUTPUT = "./tokens";

const figma = JSON.parse(fs.readFileSync(INPUT, "utf8"));

const collections = figma.meta.variableCollections || {};
const variables = figma.meta.variables || {};

const BASE_BRAND = "synergy";
const BASE_STYLE = "neutral";

/* ----------------------------------
 * Helpers
 * ---------------------------------- */

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  mkdir(path.dirname(file));
  fs.writeFileSync(file,JSON.stringify(data, null, 2));
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

function setDeep(obj, pathArray, value) {
  let current = obj;

  pathArray.forEach((segment, index) => {
    const isLeaf = index === pathArray.length - 1;

    if (isLeaf) {
      current[segment] = value;
      return;
    }

    current[segment] ??= {};
    current = current[segment];
  });
}

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

//////////////////////////////////////////////////////
// LOOKUPS
//////////////////////////////////////////////////////

const collectionLookup = {};
Object.values(collections).forEach(c => {
  collectionLookup[c.id] = c;
});

const variableLookup = {};
Object.values(variables).forEach(v => {
  variableLookup[v.id] = v;
});





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

Object.values(collections).forEach(
  (collection) => {
    collectionLookup[collection.id] =
      collection;
  }
);

/* ----------------------------------
 * Variable Lookup
 * ---------------------------------- */

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

    if (!target) {
      console.warn("Broken alias reference:", value.id);
      return `{missing-token}`;
    }

    return `{${tokenPath(
      target.name
    ).join(".")}}`;
  }

  if (variable.resolvedType === "FLOAT") {
    const name = variable.name.toLowerCase();

    // unitless tokens
    if (
      name.includes("/fw") ||
      name.includes("font-weight") ||
      name.includes("opacity") ||
      name.includes("line-height")
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
    name.startsWith("width/") ||
    name.includes("viewport")
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

    const modes = variable.valuesByMode || {};
    let value;
    // 1. try default mode
    const defaultMode = collection.defaultModeId;
    if (defaultMode && modes[defaultMode] !== undefined) {
      value = modes[defaultMode];
    }
    // 2. fallback: ANY available mode
    if (value === undefined) {
      const modeKeys = Object.keys(modes);
      if (!modeKeys.length) {
        console.warn("NO MODES:", variable.name);
        return;
      }
      const defaultMode = collection.defaultModeId;
      value =
        (defaultMode && modes[defaultMode] !== undefined)
          ? modes[defaultMode]
          : modes[modeKeys[0]];
    }
    // 3. hard safety log
    if (value === undefined) {
      console.warn("DROPPED (no modes found):", variable.name);
      return;
    }

    setDeep(
      root,
      tokenPath(variable.name),
      {
        $value:
          convertValue(
            value,
            variable
          ),

        $type:
          getTokenType(variable)
        }
    );
  }
);

/* ----------------------------------
 * Seed Extensions
 * ---------------------------------- */

Object.values(collections).forEach(
  (collection) => {
    if (!collection.isExtension)
      return;

    const group =
      getCollectionGroup(collection);

    if (
      group !== "brand" &&
      group !== "style"
    ) {
      return;
    }

    const baseCategories =
      outputs[collection.baseCollectionId];

    if (!baseCategories)
      return;

    outputs[collection.id] ??= {};

    Object.entries(baseCategories).forEach(
      ([category, tokens]) => {
        if (!outputs[collection.id][category]) {
          outputs[collection.id][category] =
            deepClone(tokens);
        }
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
            collection.id,
            category
          );

        let value;

        // try default mode
        const defaultMode = collection.defaultModeId;

        if (defaultMode && values?.[defaultMode] !== undefined) {
          value = values[defaultMode];
        }

        // fallback: first available value
        if (value === undefined) {
          const modeKeys = Object.keys(values || {});
          if (!modeKeys.length) {
            console.warn("NO EXTENSION MODES:", variable.name);
            return;
          }
          value =
            (collection.defaultModeId && values?.[collection.defaultModeId] !== undefined)
              ? values[collection.defaultModeId]
              : values[modeKeys[0]];
        }

        // safety
        if (value === undefined) {
          console.warn(
            "DROPPED EXTENSION TOKEN:",
            variable.name,
            values
          );
          return;
        }

        setDeep(
          root,
          tokenPath(variable.name),
          {
            $value:
              convertValue(
                value,
                variable
              ),

            $type:
              getTokenType(variable)
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