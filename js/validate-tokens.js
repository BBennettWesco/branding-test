import fs from "node:fs";
import path from "node:path";

const INPUT = "./tokens/raw/figma.json";
const TOKENS_DIR = "./tokens/style";

const figma = JSON.parse(fs.readFileSync(INPUT, "utf8"));

const collections = figma.meta.variableCollections || {};
const variables = figma.meta.variables || {};

const collectionLookup = {};
Object.values(collections).forEach((collection) => {
  collectionLookup[collection.id] = collection;
});

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

function getRootCollection(collection) {
  let current = collection;

  while (current?.isExtension && current?.baseCollectionId) {
    current = collectionLookup[current.baseCollectionId];
  }

  return current;
}

function getCollectionGroup(collection) {
  const root = getRootCollection(collection);
  if (!root) return null;

  const rootName = root.name.toLowerCase();
  if (rootName.includes("global")) return "brand";
  if (rootName.includes("style")) return "style";

  return null;
}

function getOutputFolder(collection) {
  const match = collection.name.match(/=["']?([^"']+)["']?/);
  if (match) {
    return match[1].trim().toLowerCase();
  }

  return collection.name.toLowerCase().replace(/"/g, "").trim();
}

function getCategory(variable) {
  const name = variable.name.toLowerCase();

  if (variable.resolvedType === "COLOR") return "color";
  if (name.includes("text") && variable.resolvedType !== "COLOR") return "typography";
  if (name.includes("spacing")) return "spacing";

  if (name.includes("radius") || name.includes("corner") || name.includes("rounded")) {
    return "radius";
  }

  if (name.includes("border-width") || (name.includes("stroke") && variable.resolvedType !== "COLOR")) {
    return "border";
  }

  if (name.includes("shadow")) return "shadow";

  if (name.includes("grid") || name.includes("container") || name.startsWith("width/") || name.includes("viewport")) {
    return "layout";
  }

  return null;
}

function isPrefixPath(shorter, longer) {
  if (shorter.length >= longer.length) return false;
  for (let i = 0; i < shorter.length; i += 1) {
    if (shorter[i] !== longer[i]) return false;
  }
  return true;
}

function flattenExpectedPath(parentPath, childPath) {
  const splitIndex = parentPath.length - 1;
  const merged = `${parentPath[splitIndex]}-${childPath[parentPath.length]}`;

  return [
    ...parentPath.slice(0, splitIndex),
    merged,
    ...childPath.slice(parentPath.length + 1),
  ];
}

function hasPath(root, pathArray) {
  let current = root;

  for (const segment of pathArray) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return false;
    }
    current = current[segment];
  }

  return true;
}

function collectMixedLeafGroupNodes(node, currentPath = [], result = []) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return result;

  const keys = Object.keys(node);
  const hasLeaf = "$value" in node || "value" in node;
  const childKeys = keys.filter((key) => !key.startsWith("$"));

  if (hasLeaf && childKeys.length) {
    result.push(currentPath.join("."));
  }

  childKeys.forEach((key) => {
    collectMixedLeafGroupNodes(node[key], [...currentPath, key], result);
  });

  return result;
}

const variablesByCollectionAndCategory = new Map();

Object.values(variables).forEach((variable) => {
  const collection = collectionLookup[variable.variableCollectionId];
  if (!collection) return;
  if (collection.isExtension) return;
  if (getCollectionGroup(collection) !== "style") return;

  const category = getCategory(variable);
  if (!category) return;

  const key = `${collection.id}::${category}`;
  const entry = variablesByCollectionAndCategory.get(key) || {
    collection,
    category,
    items: [],
  };

  entry.items.push({
    variableName: variable.name,
    path: tokenPath(variable.name),
  });

  variablesByCollectionAndCategory.set(key, entry);
});

const failures = [];
let checkedCollisionCount = 0;

for (const entry of variablesByCollectionAndCategory.values()) {
  const { collection, category, items } = entry;
  const folder = getOutputFolder(collection);
  const outputFile = path.join(TOKENS_DIR, folder, `${category}.json`);

  if (!fs.existsSync(outputFile)) {
    failures.push(`Missing generated token file: ${outputFile}`);
    continue;
  }

  const generated = JSON.parse(fs.readFileSync(outputFile, "utf8"));
  const mixedNodes = collectMixedLeafGroupNodes(generated);

  mixedNodes.forEach((mixedPath) => {
    failures.push(
      `Mixed leaf/group node in ${outputFile}: ${mixedPath || "<root>"}`
    );
  });

  for (let i = 0; i < items.length; i += 1) {
    for (let j = 0; j < items.length; j += 1) {
      if (i === j) continue;

      const parent = items[i];
      const child = items[j];

      if (!isPrefixPath(parent.path, child.path)) continue;

      checkedCollisionCount += 1;

      const expectedPath = flattenExpectedPath(parent.path, child.path);
      if (!hasPath(generated, expectedPath)) {
        failures.push(
          [
            `Missing flattened collision path in ${outputFile}`,
            `parent: ${parent.variableName} (${parent.path.join("/")})`,
            `child: ${child.variableName} (${child.path.join("/")})`,
            `expected: ${expectedPath.join("/")}`,
          ].join(" | ")
        );
      }
    }
  }
}

if (failures.length) {
  console.error("Token validation failed:");
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  process.exit(1);
}

console.log(
  `✓ Token validation passed (${checkedCollisionCount} collision path checks)`
);
