/**
 * Logs server registry.
 *
 * Logs are sold from two independent servers:
 *   Server 1 - Bulkacc
 *   Server 2 - Sujan Department
 *
 * This module is the single source of truth for their identity, credentials,
 * adapter class and admin-controlled enabled state. Both the catalog
 * (live-services) and checkout (resolve-live-service) read from here so the
 * "server off" switch cannot drift between listing and fulfillment.
 */

import pino from "pino";
import { connectMongo } from "@/lib/mongodb";
import { Provider } from "@/models/provider";
import type { BaseProviderAdapter, ProviderConfig } from "./base-adapter";
import { BulkAccAdapter } from "./adapters/bulkacc-adapter";
import { SujanDepartmentAdapter } from "./adapters/sujandepartment-adapter";

export type LogsServerId = "1" | "2";

type AdapterClass = new (id: string, config: ProviderConfig, logger?: any) => BaseProviderAdapter;

export interface LogsServerDefinition {
  id: LogsServerId;
  slug: string;
  label: string;
  name: string;
  envKey: string;
  adapterKey: string;
  Adapter: AdapterClass;
}

export const logsServerDefinitions: readonly LogsServerDefinition[] = [
  {
    id: "1",
    slug: "bulkacc",
    label: "Server 1",
    name: "Bulkacc",
    envKey: "BULKACC_API_KEY",
    adapterKey: "logs",
    Adapter: BulkAccAdapter
  },
  {
    id: "2",
    slug: "sujandepartment",
    label: "Server 2",
    name: "Sujan Department",
    envKey: "SUJANDEPARTMENT_API_KEY",
    adapterKey: "sujandepartment",
    Adapter: SujanDepartmentAdapter
  }
];

const ENABLED_CACHE_MS = 15 * 1000;
let enabledCache: { slugs: Set<string>; expiresAt: number } | null = null;

export function isLogsServerId(value: unknown): value is LogsServerId {
  return value === "1" || value === "2";
}

export function getLogsServerDefinition(id: LogsServerId): LogsServerDefinition | undefined {
  return logsServerDefinitions.find((definition) => definition.id === id);
}

export function getLogsServerDefinitionBySlug(slug: string): LogsServerDefinition | undefined {
  return logsServerDefinitions.find((definition) => definition.slug === slug);
}

export function getLogsServerApiKey(definition: LogsServerDefinition): string | undefined {
  const value = process.env[definition.envKey]?.trim();
  return value ? value : undefined;
}

export function createLogsAdapter(
  definition: LogsServerDefinition,
  apiKey: string,
  timeout = 20000
): BaseProviderAdapter {
  const logger = pino({ level: process.env.LOG_LEVEL || "info" });
  return new definition.Adapter(definition.adapterKey, { apiKey, timeout }, logger);
}

export function clearLogsServerCache() {
  enabledCache = null;
}

/**
 * Resolves which servers are both configured and switched on.
 * A server with no Provider document yet is treated as enabled so it is
 * usable before its first order (the document is created on first checkout).
 */
async function loadEnabledSlugs(): Promise<Set<string>> {
  const now = Date.now();
  if (enabledCache && enabledCache.expiresAt > now) return enabledCache.slugs;

  const slugs = new Set<string>(
    logsServerDefinitions
      .filter((definition) => Boolean(getLogsServerApiKey(definition)))
      .map((definition) => definition.slug)
  );

  try {
    await connectMongo();
    const providers = await Provider.find({
      slug: { $in: logsServerDefinitions.map((definition) => definition.slug) }
    })
      .select("slug status isHealthy")
      .lean();

    for (const provider of providers) {
      const isActive = provider.status === "ACTIVE" && provider.isHealthy !== false;
      if (!isActive) slugs.delete(provider.slug);
    }
  } catch (error) {
    // A database hiccup must not hide a configured server; the order path still
    // enforces Provider.status before fulfilling.
    console.warn("[logs-servers] Could not read provider status", error);
  }

  enabledCache = { slugs, expiresAt: now + ENABLED_CACHE_MS };
  return slugs;
}

export async function getEnabledLogsServers(): Promise<LogsServerDefinition[]> {
  const slugs = await loadEnabledSlugs();
  return logsServerDefinitions.filter((definition) => slugs.has(definition.slug));
}

export async function isLogsServerEnabled(definition: LogsServerDefinition): Promise<boolean> {
  const slugs = await loadEnabledSlugs();
  return slugs.has(definition.slug);
}

export async function assertLogsServerEnabled(definition: LogsServerDefinition): Promise<void> {
  if (!(await isLogsServerEnabled(definition))) {
    throw new Error("This server is currently unavailable. Please choose another server.");
  }
}
