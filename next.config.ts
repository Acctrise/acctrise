import type { NextConfig } from "next";
import dns from "node:dns";

// Configure DNS resolvers at process startup, before any route module loads.
// This fixes `mongodb+srv://` SRV lookups on networks whose default resolver
// (e.g. 127.0.0.1) refuses SRV queries. The MongoDB driver uses dns.promises
// internally, so it must be configured before the driver is first imported.
const dnsServers = (process.env.MONGODB_DNS_SERVERS || "")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  async redirects() {
    return [{
      source: "/:path*",
      has: [{ type: "host", value: "acctrise.com" }],
      destination: "https://www.acctrise.com/:path*",
      permanent: true
    }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" }
    ] }];
  },
  images: {
    formats: ["image/avif", "image/webp"]
  }
};

export default nextConfig;
