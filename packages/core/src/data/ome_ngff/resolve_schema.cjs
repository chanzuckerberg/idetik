const $RefParser = require("@apidevtools/json-schema-ref-parser");

// Get the URL from the command-line arguments.
// process.argv[2] is the first argument after the script name.
const url = process.argv[2];

// Check if a URL was provided.
if (!url) {
  console.error("❌ Error: Please provide a URL as a command-line argument.");
  console.error("Usage: node resolve_schema.cjs <url>");
  process.exit(1); // Exit with an error code.
}

async function resolveSchema() {
  try {
    //console.log(`⏳ Resolving schema from: ${url}`);
    
    // Use the URL from the command line.
    let schema = await $RefParser.bundle(url);
    
    // Print the fully resolved schema as a JSON string.
    console.log(JSON.stringify(schema, null, 2));
    
  } catch(err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

resolveSchema();
