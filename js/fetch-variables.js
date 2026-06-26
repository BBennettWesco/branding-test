import fs from "node:fs";

const FIGMA_ACCESS_TOKEN = process.env.FIGMA_ACCESS_TOKEN;
const FILE_KEY = process.env.FIGMA_TEST_FILE_KEY;

if (!FIGMA_ACCESS_TOKEN) {
  throw new Error("FIGMA_ACCESS_TOKEN is missing");
}
if (!FILE_KEY) {
  throw new Error("FIGMA_FILE_KEY is missing");
}

console.log("FILE_KEY:", FILE_KEY);
console.log(
  "TOKEN EXISTS:",
  FIGMA_ACCESS_TOKEN ? "YES" : "NO"
);

const EXCLUDED_COLLECTION_PATTERNS = [
  "graphicsize",
  "iconsize",
];

function shouldKeepVariable(variable) {
  const name = variable.name.toLowerCase();

  // Remove Text/fs, Text/lh, Text/ls
  if (
    name.startsWith("text/fs/") ||
    name.startsWith("text/lh/") ||
    name.startsWith("text/ls/") ||
    name.startsWith("text/ps/")
  ) {
    return false;
  }

  // Remove icon variables
  if (
    name === "icon" ||
    name.startsWith("icon/")
  ) {
    return false;
  }

  // Keep only spacing/static/*
  if (
    name.startsWith("spacing/") &&
    !name.startsWith("spacing/static")
  ) {
    return false;
  }

  return true;
}

async function fetchVariables() {
  const response = await fetch(
    `https://api.figma.com/v1/files/${FILE_KEY}/variables/local`,
    {
      headers: {
        "X-Figma-Token": FIGMA_ACCESS_TOKEN,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(errorText);

    throw new Error(
      `Figma API Error: ${response.status}`
    );
  }

  const data = await response.json();

  console.log(
    Object.values(
      data.meta.variableCollections
    ).map((c) => ({
      name: c.name,
      remote: c.remote,
      isExtension: c.isExtension,
      baseCollectionId: c.baseCollectionId
    }))
  );

  // ----------------------------------
  // Filter collections
  // ----------------------------------

  const localCollections = Object.fromEntries(
    Object.entries(
      data.meta.variableCollections || {}
    ).filter(([, collection]) => {
      if (collection.remote) {
        return false;
      }

      const collectionName =
        collection.name.toLowerCase();

      return !EXCLUDED_COLLECTION_PATTERNS.some(
        pattern =>
          collectionName.includes(pattern)
      );
    })
  );

  const localCollectionIds = new Set(
    Object.keys(localCollections)
  );

  // ----------------------------------
  // Filter variables
  // ----------------------------------

  const localVariables = Object.fromEntries(
    Object.entries(
      data.meta.variables || {}
    ).filter(([, variable]) => {

      if (variable.remote) {
        return false;
      }

      if (
        !localCollectionIds.has(
          variable.variableCollectionId
        )
      ) {
        return false;
      }

      return shouldKeepVariable(variable);
    })
  );

  console.log(
    "Filtered variables:",
    Object.values(localVariables)
      .slice(0, 20)
      .map(v => v.name)
  );

  const filteredData = {
    ...data,
    meta: {
      ...data.meta,
      variableCollections:
        localCollections,
      variables: localVariables,
    },
  };

  fs.mkdirSync("tokens/raw", {
    recursive: true,
  });

  fs.writeFileSync(
    "tokens/raw/figma.json",
    JSON.stringify(filteredData, null, 2)
  );

  console.log(
    `Collections: ${
      Object.keys(
        data.meta.variableCollections
      ).length
    } → ${
      Object.keys(localCollections)
        .length
    }`
  );

  console.log(
    `Variables: ${
      Object.keys(
        data.meta.variables
      ).length
    } → ${
      Object.keys(localVariables)
        .length
    }`
  );
}

fetchVariables();