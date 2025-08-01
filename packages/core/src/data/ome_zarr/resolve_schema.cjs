const $RefParser = require("@apidevtools/json-schema-ref-parser");

const url = process.argv[2];

if (!url) {
  console.error("Error: Please provide a URL as a command-line argument.");
  console.error("Usage: node resolve_schema.cjs <url>");
  process.exit(1);
}

async function resolveSchema() {
  try {
    let schema = await $RefParser.dereference(url);
    console.log(JSON.stringify(schema, null, 2));
  } catch(err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

resolveSchema();
