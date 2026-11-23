"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, Loader2, RefreshCcw, Save, Search, Server, TrendingUp } from "lucide-react";

type SujanProduct = {
  id: number;
  name: string;
  description?: string;
  costNgn: number;
  stock: number;
  category?: string;
  platform?: string;
  currency: string;
};

type ProductsResponse = {
  success: boolean;
  profitMarginPercent: number;
  products: SujanProduct[];
  fetchedAt: string;
};

const PRESET_MARGINS = [10, 20, 30, 50, 75, 100];

const ngn = (value: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Math.max(value, 0));

export default function SujanServer2AdminPage() {
  const [products, setProducts] = useState<SujanProduct[]>([]);
  const [margin, setMargin] = useState(50);
  const [manualInput, setManualInput] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/admin/logs-server-2/products", { cache: "no-store" });
      const payload: ProductsResponse & { error?: string } = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load products.");
      setProducts(payload.products || []);
      setMargin(Number(payload.profitMarginPercent) || 50);
      setManualInput(String(payload.profitMarginPercent ?? 50));
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load products.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveMargin(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1000) return;
    setSaving(true);
    setSaveNotice("");
    try {
      const response = await fetch("/api/admin/providers/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "sujandepartment", profitMarginPercent: value })
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Unable to save margin.");
      }
      setMargin(value);
      setManualInput(String(value));
      setSaveNotice(`Profit margin saved at ${value}%.`);
    } catch (err) {
      setSaveNotice(err instanceof Error ? err.message : "Unable to save margin.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.name} ${p.description || ""} ${p.category || ""} ${p.platform || ""} ${p.id}`.toLowerCase().includes(q)
    );
  }, [products, query]);

  const totalStock = useMemo(() => products.reduce((sum, p) => sum + p.stock, 0), [products]);
  const sellingPrice = (cost: number) => Math.round(cost * (1 + margin / 100) * 100) / 100;

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800">
            <ArrowLeft className="h-4 w-4" /> Back to Admin
          </Link>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-blue-600">Server 2 · Sujan Department</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Product catalogue &amp; pricing</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            Set the profit margin applied to every Sujan Department product, then review cost and selling prices across the live catalogue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
        >
          <RefreshCcw className="h-4 w-4" /> Refresh catalogue
        </button>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-600" /><h3 className="text-lg font-black tracking-tight text-slate-900">Profit margin</h3></div>
          <p className="mt-1 text-xs font-semibold text-slate-500">Applied to Server 2 only. Bulkacc (Server 1) is unaffected.</p>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {PRESET_MARGINS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setManualInput(String(preset)); }}
                  className={`h-10 rounded-xl px-4 text-sm font-black transition ${Number(manualInput) === preset ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20" : "border border-slate-200 bg-white text-slate-600 hover:text-blue-700"}`}
                >
                  {preset}%
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="custom-margin" className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Manual %</label>
              <input
                id="custom-margin"
                type="number"
                min="0"
                max="1000"
                step="0.5"
                value={manualInput}
                onChange={(event) => setManualInput(event.target.value)}
                className="h-11 w-32 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="e.g. 65"
              />
              <button
                type="button"
                onClick={() => void saveMargin(Number(manualInput))}
                disabled={saving || !manualInput.trim() || Number(manualInput) === margin}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save margin
              </button>
            </div>
            {saveNotice ? <p className="text-sm font-bold text-emerald-700" role="status">{saveNotice}</p> : null}
          </div>
          <div className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Active margin</p>
            <strong className="mt-1 block text-3xl font-black tracking-tight text-slate-950">{margin}%</strong>
            <p className="mt-1 text-xs font-semibold text-slate-500">Selling = cost × {(1 + margin / 100).toFixed(2)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Products</p>
          <strong className="mt-2 block text-2xl font-black text-slate-950">{products.length}</strong>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Total stock</p>
          <strong className="mt-2 block text-2xl font-black text-slate-950">{totalStock.toLocaleString()}</strong>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Currency</p>
          <strong className="mt-2 block text-2xl font-black text-slate-950">NGN</strong>
        </article>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2"><Server className="h-5 w-5 text-blue-600" /><h3 className="text-lg font-black tracking-tight text-slate-900">Live products</h3></div>
            <p className="mt-1 text-xs font-semibold text-slate-500">Cost prices from Sujan Department. Selling prices include the active margin.</p>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />
          </label>
        </div>

        {state === "loading" ? (
          <div className="grid min-h-60 place-items-center p-8 text-sm font-semibold text-slate-600">
            <span className="inline-flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Loading catalogue...</span>
          </div>
        ) : null}

        {state === "error" ? (
          <div className="m-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {state === "ready" && filtered.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-500">No products match your search.</div>
        ) : null}

        {state === "ready" && filtered.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Cost</th>
                    <th className="px-6 py-4 text-right">Selling @ {margin}%</th>
                    <th className="px-6 py-4 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((product) => (
                    <tr key={product.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{product.name}</div>
                        <div className="mt-1 max-w-md truncate text-xs font-semibold text-slate-500">{product.description}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">ID {product.id}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{product.category || "—"}</td>
                      <td className="px-6 py-4 text-right font-black tabular-nums text-slate-700">{ngn(product.costNgn)}</td>
                      <td className="px-6 py-4 text-right font-black tabular-nums text-blue-700">{ngn(sellingPrice(product.costNgn))}</td>
                      <td className="px-6 py-4 text-right"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">{product.stock.toLocaleString()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {filtered.map((product) => (
                <article key={product.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900">{product.name}</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{product.category || "Uncategorised"} · ID {product.id}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">{product.stock.toLocaleString()}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    <div><p className="text-xs font-bold text-slate-400">Cost</p><p className="font-black tabular-nums text-slate-800">{ngn(product.costNgn)}</p></div>
                    <div><p className="text-xs font-bold text-slate-400">Selling @ {margin}%</p><p className="font-black tabular-nums text-blue-700">{ngn(sellingPrice(product.costNgn))}</p></div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {state === "ready" ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Check className="h-4 w-4" /> Catalogue fetched {new Date().toLocaleString("en-NG")}. Prices are shown in Naira.
        </p>
      ) : null}
    </div>
  );
}
