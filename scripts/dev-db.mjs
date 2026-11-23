import { MongoMemoryServer } from "mongodb-memory-server";
import path from "node:path";
import fs from "node:fs";

const dbPath = path.join(process.cwd(), ".data", "mongo");
fs.mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
  instance: {
    dbName: "acctrise-dev",
    storageEngine: "wiredTiger",
    dbPath,
    port: 27017
  },
  binary: { downloadDir: path.join(process.cwd(), ".cache", "mongodb") }
});

const uri = mongod.getUri();
console.log(`MongoDB running at ${uri}`);
console.log(`Data dir: ${dbPath}`);
console.log("Press Ctrl+C to stop");

process.on("SIGINT", async () => {
  console.log("\nStopping...");
  await mongod.stop();
  process.exit(0);
});
