/**
 * Sujan Department Logs Provider Adapter (Server 2)
 * Handles account logs and bulk account services.
 *
 * API contract (verified live 2026-11-22):
 *   Base URL: https://api.sujandepartment.com
 *   Auth:     Authorization: Bearer rs_...
 *   GET  /reseller/v1/balance
 *   GET  /reseller/v1/products
 *   GET  /reseller/v1/products/{product_id}/stock
 *   POST /reseller/v1/orders  { product_id, quantity }
 *
 * Sujan Department prices are returned in NGN minor units (kobo).
 * The rest of Acctrise is USD-internal, so prices are converted to USD here.
 * The UI multiplies by the exchange rate again to display Naira.
 */

import axios, { AxiosInstance } from "axios";
import { getUsdToNgnRate } from "@/lib/pricing/exchange-rate";
import { BaseProviderAdapter, OrderRequest, OrderResponse, OrderStatus, ProviderConfig, ProviderHealth, ServiceMapping } from "../base-adapter";

const DEFAULT_BASE_URL = "https://api.sujandepartment.com";

interface SujanProduct {
  id: number;
  name: string;
  description?: string;
  price_minor: number;
  currency?: string;
  available_stock?: number;
  category?: { id?: number; name?: string } | null;
  platform?: { id?: number; name?: string } | null;
}

interface SujanEnvelope<T> {
  data?: T;
  message?: string;
}

function cleanDescription(value?: string) {
  if (!value) return undefined;
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Converts a NGN minor-unit amount (kobo) to USD using the shared exchange rate.
 */
function ngnMinorToUsd(priceMinor: number, exchangeRate: number): number {
  const priceNgn = Number(priceMinor) / 100;
  if (!Number.isFinite(priceNgn) || priceNgn <= 0) return 0;
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return 0;
  return Number((priceNgn / exchangeRate).toFixed(6));
}

/**
 * Sujan does not expose an order-status endpoint and delivers credentials
 * atomically with the purchase. Normalise whatever credential shape comes back
 * into readable blocks so the existing fulfillment UI can render them.
 */
function toCredentialBlocks(payload: any): string[] {
  const candidates = [
    payload?.accounts,
    payload?.items,
    payload?.credentials,
    payload?.data?.accounts,
    payload?.data?.items,
    payload?.data?.credentials,
    Array.isArray(payload) ? payload : null
  ];

  const list = candidates.find((value) => Array.isArray(value)) as any[] | undefined;
  if (list) {
    return list
      .map((entry) => {
        if (entry === null || entry === undefined) return "";
        if (typeof entry === "string") return entry.trim();
        if (typeof entry !== "object") return String(entry);
        return Object.entries(entry)
          .filter(([, value]) => value !== null && value !== undefined && value !== "")
          .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
          .join("\n");
      })
      .filter(Boolean);
  }

  const direct = payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : payload;
  if (direct && typeof direct === "object") {
    const lines = Object.entries(direct)
      .filter(([key]) => !["id", "order_id", "status", "message", "total", "quantity", "product_id"].includes(key))
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .filter(([, value]) => typeof value !== "object")
      .map(([key, value]) => `${key}: ${String(value)}`);
    if (lines.length) return [lines.join("\n")];
  }

  return [];
}

export class SujanDepartmentAdapter extends BaseProviderAdapter {
  private client: AxiosInstance;

  constructor(providerId: string, config: ProviderConfig, logger?: any) {
    super(providerId, config, logger);

    const baseUrl = config.baseUrl || process.env.SUJANDEPARTMENT_BASE_URL || DEFAULT_BASE_URL;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      }
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await this.client.get<SujanEnvelope<{ balance?: string }>>("/reseller/v1/balance");
      const ok = response.status === 200 && response.data?.data !== undefined;
      if (ok) this.log("info", "Sujan Department authentication successful");
      return ok;
    } catch (error) {
      this.log("error", "Sujan Department authentication failed", error);
      return false;
    }
  }

  private getProfitMarginRate(): number {
    const config = this.config as any;
    const rate = Number(config?.profitMarginRate);
    if (Number.isFinite(rate) && rate >= 0) return rate;
    // Default 50% if not configured
    return 0.5;
  }

  async fetchServices(): Promise<ServiceMapping[]> {
    try {
      const [response, exchange] = await Promise.all([
        this.client.get<SujanEnvelope<SujanProduct[]>>("/reseller/v1/products"),
        getUsdToNgnRate()
      ]);

      const contentType = String(response.headers?.["content-type"] || "");
      const body = response.data;
      if (contentType.includes("text/html") || typeof body === "string" && /recaptcha|bot verification|verifying that you are not a robot/i.test(body)) {
        throw new Error("Sujan Department is currently challenging this server's IP with a bot-verification page. Ask the provider to whitelist the deployment IP, then retry.");
      }

      const products = body?.data;
      if (!Array.isArray(products)) {
        throw new Error(body?.message || "Sujan Department product list did not include products.");
      }

      return products
        .filter((product) => product && Number(product.available_stock || 0) > 0)
        .map((product) => {
          const currency = String(product.currency || "NGN").toUpperCase();
          if (currency !== "NGN") {
            throw new Error(`Unsupported Sujan Department currency: ${currency}`);
          }
          const baseUsd = ngnMinorToUsd(product.price_minor, exchange.rate);
          const profitRate = this.getProfitMarginRate();
          return {
            externalId: String(product.id),
            name: product.name,
            price: Number((baseUsd * (1 + profitRate)).toFixed(6)),
            minOrder: 1,
            maxOrder: Number(product.available_stock || 0),
            description: cleanDescription(product.description) || product.name,
            categoryName: product.category?.name,
            groupName: product.platform?.name,
            stock: Number(product.available_stock || 0)
          };
        });
    } catch (error) {
      this.log("error", "Failed to fetch Sujan Department services", error);
      throw error;
    }
  }

  /**
   * Raw catalog for the admin products page. Returns NGN cost prices with no
   * profit margin applied, so the admin can see what each product actually
   * costs before the configured margin is added.
   */
  async fetchAdminProducts(): Promise<Array<{
    id: number;
    name: string;
    description?: string;
    costNgn: number;
    stock: number;
    category?: string;
    platform?: string;
    currency: string;
  }>> {
    try {
      const response = await this.client.get<SujanEnvelope<SujanProduct[]>>("/reseller/v1/products");
      const contentType = String(response.headers?.["content-type"] || "");
      const body = response.data;
      if (contentType.includes("text/html") || typeof body === "string" && /recaptcha|bot verification/i.test(body)) {
        throw new Error("Sujan Department is currently challenging this server's IP with a bot-verification page. Ask the provider to whitelist the deployment IP, then retry.");
      }
      const products = body?.data;
      if (!Array.isArray(products)) {
        throw new Error(body?.message || "Sujan Department product list did not include products.");
      }
      return products.map((product) => ({
        id: product.id,
        name: product.name,
        description: cleanDescription(product.description) || product.name,
        costNgn: Number(product.price_minor) / 100,
        stock: Number(product.available_stock || 0),
        category: product.category?.name,
        platform: product.platform?.name,
        currency: String(product.currency || "NGN")
      }));
    } catch (error) {
      this.log("error", "Failed to fetch Sujan Department admin products", error);
      throw error;
    }
  }

  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    try {
      const productId = Number(request.serviceId);
      if (!Number.isFinite(productId) || productId <= 0) {
        throw new Error("Sujan Department product id is invalid.");
      }

      const quantity = Math.max(1, Math.floor(Number(request.quantity) || 1));
      const response = await this.client.post<SujanEnvelope<any>>("/reseller/v1/orders", {
        product_id: productId,
        quantity
      });

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(response.data?.message || "Sujan Department order was not accepted.");
      }

      const payload = response.data?.data ?? response.data;
      const accounts = toCredentialBlocks(payload);
      const orderId = payload?.order_id ?? payload?.id ?? payload?.order?.id;
      const externalOrderId = orderId !== undefined && orderId !== null
        ? String(orderId)
        : `sujan-${productId}-${Date.now()}`;

      // Credentials are delivered atomically with the purchase. If nothing came
      // back, surface the order as processing rather than pretending success.
      return {
        externalOrderId,
        status: accounts.length ? "completed" : "processing",
        message: accounts.length
          ? `${accounts.length} account${accounts.length === 1 ? "" : "s"} delivered`
          : response.data?.message || "Order accepted by Sujan Department",
        data: {
          accounts,
          provider: "sujandepartment",
          providerOrderId: orderId ?? null,
          quantity
        }
      };
    } catch (error) {
      this.log("error", "Failed to place Sujan Department order", error);
      throw error;
    }
  }

  async checkOrderStatus(externalOrderId: string): Promise<OrderStatus> {
    // Sujan Department exposes POST /reseller/v1/orders only (GET returns 405),
    // so there is no remote status to poll. Delivery happens in placeOrder.
    return {
      externalOrderId,
      status: "completed",
      progress: 100,
      message: "Sujan Department delivers credentials at purchase; live status is not exposed.",
      lastUpdated: new Date()
    };
  }

  async checkHealth(): Promise<ProviderHealth> {
    try {
      const isHealthy = await this.authenticate();
      return {
        isHealthy,
        status: isHealthy ? "active" : "error",
        lastCheck: new Date(),
        message: isHealthy ? "Sujan Department is operational" : "Sujan Department is unreachable"
      };
    } catch (error) {
      return {
        isHealthy: false,
        status: "error",
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : "Sujan Department health check failed"
      };
    }
  }

  async refundOrder(): Promise<boolean> {
    // No documented refund endpoint. Refunds must be handled manually.
    this.log("warn", "Sujan Department does not expose a refund endpoint; manual refund required");
    return false;
  }

  async getSupportedPaymentMethods(): Promise<string[]> {
    return ["wallet"];
  }
}
