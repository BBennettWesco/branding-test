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
  let index = 0;

  const isLeafToken = (node) =>
    !!(
      node &&
      typeof node === "object" &&
      !Array.isArray(node) &&
      ("$value" in node || "value" in node)
    );

  while (index < pathArray.length) {
    const segment = pathArray[index];
    const isLeaf = index === pathArray.length - 1;

    if (isLeaf) {
      const existing = current[segment];

      // If a group already exists at this key, preserve it by hoisting one level
      // into hyphenated siblings before writing the leaf token.
      if (
        existing &&
        typeof existing === "object" &&
        !Array.isArray(existing) &&
        !isLeafToken(existing)
      ) {
        Object.entries(existing).forEach(([childKey, childValue]) => {
          const mergedKey = `${segment}-${childKey}`;
          if (current[mergedKey] === undefined) {
            current[mergedKey] = childValue;
          }
        });
      }

      current[segment] = value;
      return;
    }

    const existing = current[segment];

    // Parent is already a token leaf, so flatten this branch one level.
    if (isLeafToken(existing)) {
      const nextSegment = pathArray[index + 1];
      const mergedKey = `${segment}-${nextSegment}`;
      const mergedIsLeaf = index + 1 === pathArray.length - 1;

      if (mergedIsLeaf) {
        current[mergedKey] = value;
        return;
      }

      current[mergedKey] ??= {};
      current = current[mergedKey];
      index += 2;
      continue;
    }

    current[segment] ??= {};
    current = current[segment];
    index += 1;
  }
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

function getCollectionModeInfo(collection) {
  const modes = collection?.modes || [];

  const defaultMode =
    modes.find(
      (mode) =>
        mode?.modeId ===
        collection?.defaultModeId
    ) || modes[0] || null;

  const defaultModeId =
    defaultMode?.modeId || null;

  const invertMode =
    modes.find(
      (mode) =>
        mode?.name
          ?.toLowerCase()
          .trim() === "invert"
    ) ||
    modes.find((mode) =>
      mode?.name
        ?.toLowerCase()
        .includes("invert")
    ) ||
    modes.find(
      (mode) =>
        mode?.modeId &&
        mode.modeId !== defaultModeId
    );

  return {
    defaultModeId,
    invertModeId:
      invertMode?.modeId || null,
    defaultParentModeId:
      defaultMode?.parentModeId ||
      defaultModeId,
    invertParentModeId:
      invertMode?.parentModeId ||
      invertMode?.modeId ||
      defaultMode?.parentModeId ||
      defaultModeId,
  };
}

function pickModeValue(values, modeIds) {
  for (const modeId of modeIds) {
    if (
      modeId &&
      values?.[modeId] !== undefined
    ) {
      return values[modeId];
    }
  }

  return undefined;
}

function getPrimaryModeValue(
  modeValues,
  collection,
  variableName,
  missingModesLog,
  droppedLog
) {
  const values = modeValues || {};
  let value;

  const defaultMode =
    collection.defaultModeId;

  if (
    defaultMode &&
    values[defaultMode] !== undefined
  ) {
    value = values[defaultMode];
  }

  if (value === undefined) {
    const modeKeys =
      Object.keys(values);

    if (!modeKeys.length) {
      console.warn(
        missingModesLog,
        variableName
      );
      return undefined;
    }

    value =
      (defaultMode &&
      values[defaultMode] !== undefined)
        ? values[defaultMode]
        : values[modeKeys[0]];
  }

  if (value === undefined) {
    console.warn(
      droppedLog,
      variableName
    );
    return undefined;
  }

  return value;
}

function getStyleModeValues(
  modeValues,
  collection,
  variableName,
  missingModesLog,
  droppedLog
) {
  const values = modeValues || {};
  const modeKeys =
    Object.keys(values);

  if (!modeKeys.length) {
    console.warn(
      missingModesLog,
      variableName
    );
    return null;
  }

  const modeInfo =
    getCollectionModeInfo(collection);

  const defaultValue =
    getPrimaryModeValue(
      values,
      collection,
      variableName,
      missingModesLog,
      droppedLog
    );

  if (defaultValue === undefined) {
    return null;
  }

  let invertValue = defaultValue;

  if (
    modeInfo.invertModeId &&
    values[modeInfo.invertModeId] !==
      undefined
  ) {
    invertValue =
      values[modeInfo.invertModeId];
  }

  return {
    defaultValue,
    invertValue,
  };
}

function buildTokenPayload(
  variable,
  value,
  invertValue
) {
  const payload = {
    $value:
      convertValue(
        value,
        variable
      ),
    $type:
      getTokenType(variable)
  };

  if (invertValue !== undefined) {
    payload.$extensions = {
      modes: {
        invert:
          convertValue(
            invertValue,
            variable
          )
      }
    };
  }

  return payload;
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

    const group =
      getCollectionGroup(collection);

    if (
      group !== "brand" &&
      group !== "style"
    ) {
      return;
    }

    const category =
      getCategory(variable);
      
    if (!category)
      return;

    const root =
      ensureOutput(
        collection.id,
        category
      );

    if (group === "style") {
      const styleValues =
        getStyleModeValues(
          variable.valuesByMode,
          collection,
          variable.name,
          "NO STYLE MODES:",
          "DROPPED STYLE TOKEN:"
        );

      if (!styleValues)
        return;

      setDeep(
        root,
        tokenPath(variable.name),
        buildTokenPayload(
          variable,
          styleValues.defaultValue,
          styleValues.invertValue
        )
      );

      return;
    }

    const value =
      getPrimaryModeValue(
        variable.valuesByMode,
        collection,
        variable.name,
        "NO MODES:",
        "DROPPED (no modes found):"
      );

    if (value === undefined)
      return;

    setDeep(
      root,
      tokenPath(variable.name),
      buildTokenPayload(
        variable,
        value
      )
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

    const group =
      getCollectionGroup(collection);

    if (
      group !== "brand" &&
      group !== "style"
    ) {
      return;
    }

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

        if (!category)
          return;

        const root =
          ensureOutput(
            collection.id,
            category
          );

        if (group === "style") {
          const modeInfo =
            getCollectionModeInfo(collection);

          const baseCollection =
            collectionLookup[
              variable.variableCollectionId
            ];

          const baseModeInfo =
            getCollectionModeInfo(
              baseCollection || {}
            );

          const baseModes =
            variable.valuesByMode || {};

          const defaultValue =
            pickModeValue(values, [
              modeInfo.defaultModeId,
            ]) ??
            pickModeValue(baseModes, [
              modeInfo.defaultParentModeId,
              baseModeInfo.defaultModeId,
            ]) ??
            pickModeValue(values, [
              modeInfo.invertModeId,
            ]);

          const invertValue =
            pickModeValue(values, [
              modeInfo.invertModeId,
            ]) ??
            pickModeValue(baseModes, [
              modeInfo.invertParentModeId,
              baseModeInfo.invertModeId,
              modeInfo.defaultParentModeId,
              baseModeInfo.defaultModeId,
            ]) ??
            defaultValue;

          const styleValues =
            defaultValue === undefined
              ? null
              : {
                  defaultValue,
                  invertValue,
                };

          if (!styleValues) {
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
            buildTokenPayload(
              variable,
              styleValues.defaultValue,
              styleValues.invertValue
            )
          );

          return;
        }

        const value =
          getPrimaryModeValue(
            values,
            collection,
            variable.name,
            "NO EXTENSION MODES:",
            "DROPPED EXTENSION TOKEN:"
          );

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
          buildTokenPayload(
            variable,
            value
          )
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