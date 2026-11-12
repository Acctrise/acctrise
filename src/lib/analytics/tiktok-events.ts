import { createHash } from "node:crypto";

const TIKTOK_EVENTS_API_URL = "https://business-api.tiktok.com/open_api/v1.3/pixel/track/";
const DEFAULT_PIXEL_ID = "DB9JVKJC77UAEK31ALRG";

type TikTokEventInput = {
  event: "CompleteRegistration" | "Purchase" | "ViewContent" | "AddToCart" | "InitiateCheckout";
  eventId: string;
  email?: string;
  externalId?: string;
  ip?: string;
  userAgent?: string;
  pageUrl?: string;
  properties?: Record<string, unknown>;
};

type TikTokApiResponse = {
  code?: number;
  message?: string;
  request_id?: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function configuredValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/**
 * Reports a web event directly from the server to TikTok.
 *
 * Returns null when Events API is not configured. Identity values are hashed
 * before leaving the server, as required by TikTok's Events API.
 */
export async function sendTikTokEvent(input: TikTokEventInput): Promise<TikTokApiResponse | null> {
  const accessToken = configuredValue("TIKTOK_EVENTS_API_ACCESS_TOKEN");
  if (!accessToken) return null;

  const pixelCode = configuredValue("TIKTOK_PIXEL_ID") || DEFAULT_PIXEL_ID;
  const testEventCode = configuredValue("TIKTOK_TEST_EVENT_CODE");
  const user: Record<string, string> = {};

  if (input.email) user.email = sha256(input.email);
  if (input.externalId) user.external_id = sha256(input.externalId);

  const payload = {
    pixel_code: pixelCode,
    event: input.event,
    event_id: input.eventId,
    timestamp: new Date().toISOString(),
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
    context: {
      page: {
        url: input.pageUrl || process.env.NEXTAUTH_URL || "https://acctrise.com"
      },
      user,
      ...(input.ip ? { ip: input.ip } : {}),
      ...(input.userAgent ? { user_agent: input.userAgent } : {})
    },
    ...(input.properties ? { properties: input.properties } : {})
  };

  const response = await fetch(TIKTOK_EVENTS_API_URL, {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000)
  });

  const result = (await response.json().catch(() => ({}))) as TikTokApiResponse;
  if (!response.ok || (typeof result.code === "number" && result.code !== 0)) {
    throw new Error(`TikTok Events API rejected ${input.event}: ${result.message || `HTTP ${response.status}`}`);
  }

  return result;
}
