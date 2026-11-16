// A helper for tools/check-all.mjs. It never touches your real data.
//
//   node scripts/test-db.mjs uri     prints the address of the TEST database (your database's name + _test)
//   node scripts/test-db.mjs reset   empties every collection in the test database
//
// "reset" refuses to run unless the database it's connected to has a name ending in _test.

import mongoose from "mongoose";
import { env } from "../config/env.js";

const command = process.argv[2];

// Same cluster, same user, but the database name gets _test on the end.
function testUri(uri) {
  let url;
  try {
    url = new URL(uri);
  } catch {
    throw new Error("MONGODB_URI isn't an address in the usual format, so a test database name can't be worked out.");
  }

  const name = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const testName = name ? (name.endsWith("_test") ? name : `${name}_test`) : "brainboard_test";

  url.pathname = `/${encodeURIComponent(testName)}`;
  return url.toString();
}

async function main() {
  if (command === "uri") {
    console.log(testUri(env.mongodbUri));
    return;
  }

  if (command === "reset") {
    await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });

    try {
      const name = mongoose.connection.name;
      if (!name.endsWith("_test")) {
        throw new Error(`Refusing to wipe "${name}": only databases whose name ends in _test can be wiped.`);
      }

      let removed = 0;
      for (const { name: collection } of await mongoose.connection.db.listCollections().toArray()) {
        if (collection.startsWith("system.")) continue;
        const result = await mongoose.connection.db.collection(collection).deleteMany({});
        removed += result.deletedCount ?? 0;
      }
      console.log(`Wiped the test database "${name}" (${removed} documents).`);
    } finally {
      await mongoose.disconnect();
    }
    return;
  }

  throw new Error("Usage: node scripts/test-db.mjs uri | reset");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error.message);
    process.exit(1);
  }
);