import dns from "node:dns";
import mongoose from "mongoose";

let dnsConfigured = false;

function applyDnsServers() {
  if (dnsConfigured) return;
  const servers = (process.env.MONGODB_DNS_SERVERS || "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);
  if (servers.length) {
    dns.setServers(servers);
    dnsConfigured = true;
  }
}

type CachedConnection = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongo = globalThis as typeof globalThis & {
  mongooseConnection?: CachedConnection;
};

const cached = globalForMongo.mongooseConnection || {
  connection: null,
  promise: null
};

globalForMongo.mongooseConnection = cached;

async function connectWithRetry(uri: string): Promise<typeof mongoose> {
  try {
    return await mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10
    });
  } catch {
    // The MongoDB driver's SRV resolver can need one cold attempt before it
    // works. Retry once after reapplying DNS settings.
    dnsConfigured = false;
    applyDnsServers();
    return await mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10
    });
  }
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (cached.connection) {
    return cached.connection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required. Add your MongoDB Atlas connection string to .env.");
  }

  applyDnsServers();

  if (!cached.promise) {
    cached.promise = connectWithRetry(uri).catch((error) => {
      cached.promise = null;
      throw error;
    });
  }

  cached.connection = await cached.promise;
  return cached.connection;
}
