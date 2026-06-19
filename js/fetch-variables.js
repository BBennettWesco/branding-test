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

  fs.mkdirSync("tokens/raw", {
    recursive: true,
  });

  fs.writeFileSync(
    "tokens/raw/figma.json",
    JSON.stringify(data, null, 2)
  );
}

fetchVariables();
