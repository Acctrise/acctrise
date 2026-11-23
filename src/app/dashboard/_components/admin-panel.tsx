"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Ban, CheckCircle2, Percent, RefreshCcw, Save, Search, Server, ShieldCheck, ShoppingBag, Smartphone, Users, WalletCards, Mail, Send, X, Loader2, ChevronDown } from "lucide-react";
import { StatusPill } from "./dashboard-widgets";
import { SignupTracker } from "./signup-tracker";

type AdminUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
  balance: string;
  joinedAt?: string;
  lastLoginAt?: string | null;
};

type AdminPayload = {
  stats: {
    revenue: string;
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
  };
  users: AdminUser[];
  activities: AdminActivity[];
};

type AdminActivity = {
  id: string;
  orderNumber: string;
  user: { id: string; name: string; email: string; status: string };
  serviceName: string;
  kind: string;
  quantity: number;
  amount: string;
  amountCents: number;
  status: string;
  provider: string;
  createdAt: string;
  completedAt?: string | null;
};

type NumberPricing = {
  standardMarkupPercent: number;
  lowCostMarkupPercent: number;
  lowCostThresholdUsd: number;
  minimumPriceNgn: number;
  majorSocialPriceNgn: number;
  discordPriceNgn: number;
  usaWhatsappPriceNgn: number;
  providerMaxPriceUsd: number;
  usaWhatsappProviderMaxPriceUsd: number;
};


function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminPanel() {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [activityQuery, setActivityQuery] = useState("");
  const [activityStatus, setActivityStatus] = useState("ALL");
  const [numberPricing, setNumberPricing] = useState<NumberPricing | null>(null);
  const [pricingMessage, setPricingMessage] = useState("");
  const [savingPricing, setSavingPricing] = useState(false);
  const [servers, setServers] = useState<Array<{ slug: string; label: string; name: string; enabled: boolean; profitMarginPercent?: number }>>([]);
  const [busyServer, setBusyServer] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState("");
  const [marginInputs, setMarginInputs] = useState<Record<string, string>>({});
  const [savingMargin, setSavingMargin] = useState<string | null>(null);

  // Email broadcast state
  const [broadcastMode, setBroadcastMode] = useState<"single" | "all">("single");
  const [broadcastEmail, setBroadcastEmail] = useState("");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastCtaLabel, setBroadcastCtaLabel] = useState("");
  const [broadcastCtaUrl, setBroadcastCtaUrl] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState<"idle" | "sending" | "polling" | "error">("idle");
  const [broadcastMessageText, setBroadcastMessageText] = useState("");
  const [broadcastProgress, setBroadcastProgress] = useState<{
    id: string;
    status: string;
    total: number;
    sent: number;
    failed: number;
    progress: number;
    currentChunk: number;
    chunks: Array<{ status: string; total: number; sent: number; failed: number }>;
  } | null>(null);
  const [broadcastHistory, setBroadcastHistory] = useState<Array<{
    id: string;
    mode: string;
    subject: string;
    status: string;
    total: number;
    sent: number;
    failed: number;
    progress: number;
    createdAt: string;
  }>>([]);
  const [busyBroadcastId, setBusyBroadcastId] = useState<string | null>(null);

  async function loadServers() {
    try {
      const response = await fetch("/api/admin/providers/status", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load servers.");
      setServers(Array.isArray(payload.servers) ? payload.servers : []);
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Unable to load servers.");
    }
  }

  async function toggleServer(slug: string, enabled: boolean) {
    setBusyServer(slug);
    setServerMessage("");
    try {
      const response = await fetch("/api/admin/providers/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, enabled })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update the server.");
      setServers((current) => current.map((server) => server.slug === slug ? { ...server, enabled: payload.server.enabled } : server));
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Unable to update the server.");
    } finally {
      setBusyServer(null);
    }
  }

  async function saveMargin(slug: string) {
    const value = Number(marginInputs[slug] || "");
    if (!Number.isFinite(value) || value < 0 || value > 1000) return;
    setSavingMargin(slug);
    try {
      const response = await fetch("/api/admin/providers/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, profitMarginPercent: value })
      });
      if (!response.ok) throw new Error("Failed to save");
      setServers((current) =>
        current.map((s) => s.slug === slug ? { ...s, profitMarginPercent: value } : s)
      );
      setMarginInputs((prev) => ({ ...prev, [slug]: "" }));
    } catch (error) {
      alert("Failed to save profit margin");
    } finally {
      setSavingMargin(null);
    }
  }

  async function load() {
    setState("loading");
    setMessage("");
    try {
      const [response, pricingResponse] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/pricing", { cache: "no-store" })
      ]);
      const [payload, pricingPayload] = await Promise.all([response.json(), pricingResponse.json()]);
      if (!response.ok) throw new Error(payload.error || "Unable to load admin panel.");
      if (!pricingResponse.ok) throw new Error(pricingPayload.error || "Unable to load number pricing.");
      setData(payload);
      setNumberPricing(pricingPayload.numberPricing);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load admin panel.");
      setState("error");
    }
  }

  function updateNumberPricing(field: keyof NumberPricing, value: string) {
    const parsed = Number(value);
    setNumberPricing((current) => current ? { ...current, [field]: Number.isFinite(parsed) ? parsed : 0 } : current);
  }

  async function saveNumberPricing() {
    if (!numberPricing) return;
    setSavingPricing(true);
    setPricingMessage("");
    try {
      const response = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(numberPricing)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save number pricing.");
      setNumberPricing(payload.numberPricing);
      setPricingMessage("Number pricing updated. New catalog loads and checkouts will use these values.");
    } catch (error) {
      setPricingMessage(error instanceof Error ? error.message : "Unable to save number pricing.");
    } finally {
      setSavingPricing(false);
    }
  }

  async function loadBroadcastHistory() {
    try {
      const response = await fetch("/api/admin/email/broadcast?limit=10", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.broadcasts) {
        setBroadcastHistory(payload.broadcasts);
      }
    } catch (error) {
      console.error("[admin/broadcast/history]", error);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadServers(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadBroadcastHistory(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function updateUser(userId: string, updates: { status?: "active" | "banned"; role?: string }) {
    setBusyUserId(userId);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update user.");
      setData((current) => {
        if (!current) return current;
        const users = current.users.map((user) => user.id === userId ? payload.user : user);
        const activities = current.activities.map((activity) => activity.user.id === userId ? { ...activity, user: { ...activity.user, status: payload.user.status } } : activity);
        return {
          ...current,
          stats: {
            ...current.stats,
            activeUsers: users.filter((user) => user.status === "active").length,
            bannedUsers: users.filter((user) => user.status === "banned").length
          },
          users,
          activities
        };
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function sendBroadcast() {
    if (!broadcastSubject.trim() || !broadcastMessage.trim()) {
      setBroadcastMessageText("Subject and message are required");
      return;
    }
    if (broadcastMode === "single" && !broadcastEmail.trim()) {
      setBroadcastMessageText("Recipient email is required");
      return;
    }

    setBroadcastStatus("sending");
    setBroadcastMessageText("");
    try {
      const response = await fetch("/api/admin/email/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: broadcastMode,
          subject: broadcastSubject.trim(),
          message: broadcastMessage.trim(),
          email: broadcastMode === "single" ? broadcastEmail.trim() : undefined,
          ctaLabel: broadcastCtaLabel.trim() || undefined,
          ctaUrl: broadcastCtaUrl.trim() || undefined
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to send broadcast");

      setBroadcastStatus("polling");
      setBroadcastMessageText("Broadcast queued. Sending...");
      // Start polling immediately so progress updates instead of hanging on "Sending..."
      void pollBroadcast(payload.broadcast.id);
    } catch (error) {
      setBroadcastStatus("error");
      setBroadcastMessageText(error instanceof Error ? error.message : "Failed to send broadcast");
    }
  }

  async function pollBroadcast(id: string) {
    setBusyBroadcastId(id);
    try {
      const response = await fetch(`/api/admin/email/broadcast/${encodeURIComponent(id)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load broadcast status");

      const b = payload.broadcast;
      setBroadcastProgress({
        id: b.id,
        status: b.status,
        total: b.total,
        sent: b.sent,
        failed: b.failed,
        progress: b.progress,
        currentChunk: b.currentChunk,
        chunks: b.chunks
      });

      if (b.status === "processing" || b.status === "queued" || b.status === "paused") {
        setBroadcastMessageText(`Sending... ${b.sent}/${b.total} (${b.progress}%)`);
        window.setTimeout(() => void pollBroadcast(id), 3000);
      } else if (b.status === "done") {
        setBroadcastStatus("idle");
        setBroadcastMessageText(`Done! Sent ${b.sent}, failed ${b.failed}`);
        loadBroadcastHistory();
      } else if (b.status === "failed") {
        setBroadcastStatus("error");
        setBroadcastMessageText(`Failed. Sent ${b.sent}, failed ${b.failed}`);
      } else if (b.status === "paused") {
        setBroadcastMessageText(`Paused at limit. Resumes automatically. ${b.sent}/${b.total}`);
      }
    } catch (error) {
      setBroadcastMessageText(error instanceof Error ? error.message : "Failed to poll broadcast");
    } finally {
      setBusyBroadcastId(null);
    }
  }

  async function resumeBroadcast(id: string) {
    try {
      const response = await fetch(`/api/admin/email/broadcast/${encodeURIComponent(id)}`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to resume broadcast");
      setBroadcastMessageText("Resuming...");
      pollBroadcast(id);
    } catch (error) {
      setBroadcastMessageText(error instanceof Error ? error.message : "Failed to resume broadcast");
    }
  }

  const statCards = useMemo(() => data ? [
    { label: "Total money made", value: data.stats.revenue, icon: WalletCards },
    { label: "Total users", value: data.stats.totalUsers.toLocaleString(), icon: Users },
    { label: "Active users", value: data.stats.activeUsers.toLocaleString(), icon: CheckCircle2 },
    { label: "Banned users", value: data.stats.bannedUsers.toLocaleString(), icon: Ban }
  ] : [], [data]);
  const filteredActivities = useMemo(() => {
    const query = activityQuery.trim().toLowerCase();
    return (data?.activities || []).filter((activity) => {
      if (activityStatus !== "ALL" && activity.status !== activityStatus) return false;
      if (!query) return true;
      return [activity.orderNumber, activity.user.name, activity.user.email, activity.serviceName, activity.kind, activity.provider]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [activityQuery, activityStatus, data]);

  return (
    <div className="admin-panel-page mx-auto grid max-w-7xl gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Admin</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Control panel</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">Monitor platform revenue, view users, and ban or unban accounts.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5">
          <RefreshCcw className="h-4 w-4" /> Refresh
        </button>
      </section>

      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</div> : null}

      {state === "loading" ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500 shadow-sm">Loading admin data...</div> : null}

      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <article key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white"><card.icon className="h-5 w-5" /></span>
                  <ShieldCheck className="h-5 w-5 text-blue-500" />
                </div>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{card.label}</p>
                <strong className="mt-2 block text-3xl font-black tracking-tight text-slate-950">{card.value}</strong>
              </article>
            ))}
          </section>

          {numberPricing ? (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white"><Smartphone className="h-5 w-5" /></span>
                  <div><h3 className="text-lg font-black tracking-tight text-slate-900">Number pricing</h3><p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-500">Edit every number tier. Markup percentages are added to the provider cost; fixed prices act as minimum customer prices.</p></div>
                </div>
                <button type="button" onClick={() => void saveNumberPricing()} disabled={savingPricing} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Save className="h-4 w-4" />{savingPricing ? "Saving..." : "Save pricing"}</button>
              </div>
              <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="mb-4 flex items-center gap-2"><Percent className="h-4 w-4 text-blue-600" /><h4 className="font-black text-slate-900">Percentage tiers</h4></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PricingInput label="Standard markup" suffix="%" value={numberPricing.standardMarkupPercent} onChange={(value) => updateNumberPricing("standardMarkupPercent", value)} help="Added to normal provider prices." />
                    <PricingInput label="Low-cost markup" suffix="%" value={numberPricing.lowCostMarkupPercent} onChange={(value) => updateNumberPricing("lowCostMarkupPercent", value)} help="Added when provider cost is below the threshold." />
                    <PricingInput label="Low-cost threshold" prefix="$" value={numberPricing.lowCostThresholdUsd} step="0.001" onChange={(value) => updateNumberPricing("lowCostThresholdUsd", value)} help="Provider prices below this use the low-cost markup." />
                    <PricingInput label="General provider limit" prefix="$" value={numberPricing.providerMaxPriceUsd} step="0.01" onChange={(value) => updateNumberPricing("providerMaxPriceUsd", value)} help="Highest provider cost accepted for most numbers." />
                    <PricingInput label="USA WhatsApp provider limit" prefix="$" value={numberPricing.usaWhatsappProviderMaxPriceUsd} step="0.01" onChange={(value) => updateNumberPricing("usaWhatsappProviderMaxPriceUsd", value)} help="Highest provider cost accepted for USA WhatsApp." />
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <h4 className="mb-4 font-black text-slate-900">Minimum customer prices</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PricingInput label="All numbers" prefix="₦" value={numberPricing.minimumPriceNgn} onChange={(value) => updateNumberPricing("minimumPriceNgn", value)} help="Minimum price for any number." />
                    <PricingInput label="Major social apps" prefix="₦" value={numberPricing.majorSocialPriceNgn} onChange={(value) => updateNumberPricing("majorSocialPriceNgn", value)} help="WhatsApp, Facebook, Instagram, TikTok and similar apps." />
                    <PricingInput label="Discord" prefix="₦" value={numberPricing.discordPriceNgn} onChange={(value) => updateNumberPricing("discordPriceNgn", value)} />
                    <PricingInput label="USA WhatsApp" prefix="₦" value={numberPricing.usaWhatsappPriceNgn} onChange={(value) => updateNumberPricing("usaWhatsappPriceNgn", value)} />
                  </div>
                </div>
              </div>
              {pricingMessage ? <div className={`border-t px-5 py-4 text-sm font-bold sm:px-6 ${pricingMessage.startsWith("Number pricing updated") ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-900"}`}>{pricingMessage}</div> : null}
            </section>
          ) : null}

          <SignupTracker />

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" /><h3 className="text-lg font-black tracking-tight text-slate-900">Logs servers</h3></div>
                <p className="mt-1 text-xs font-semibold text-slate-500">Turning a server off hides it from customers immediately. The other server keeps selling.</p>
              </div>
              <Link href="/dashboard/admin/logs-server-2" className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100">
                <Server className="h-4 w-4" /> Server 2 products
              </Link>
            </div>
            {serverMessage ? <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{serverMessage}</div> : null}
            {servers.length ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {servers.map((server) => {
                  const isSujan = server.slug === "sujandepartment";
                  const inputValue = marginInputs[server.slug] || "";
                  const isSaving = savingMargin === server.slug;

                  return (
                    <article key={server.slug} className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="min-w-0 w-full">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{server.label}</p>
                        <strong className="mt-1 block text-base font-black text-slate-900">{server.name}</strong>
                        <span className={server.enabled ? "mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100" : "mt-2 inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-100"}>{server.enabled ? "Selling" : "Off"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleServer(server.slug, !server.enabled)}
                        disabled={busyServer === server.slug}
                        className={server.enabled ? "h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:text-rose-700 disabled:opacity-60" : "h-10 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60"}
                      >
                        {busyServer === server.slug ? "Saving..." : server.enabled ? "Turn off" : "Turn on"}
                      </button>
                      {isSujan ? (
                        <div className="w-full flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Profit %</label>
                          <input
                            type="number"
                            min="0"
                            max="1000"
                            step="1"
                            placeholder={server.profitMarginPercent ? `${server.profitMarginPercent}%` : "50%"}
                            value={inputValue}
                            onChange={(e) => setMarginInputs((prev) => ({ ...prev, [server.slug]: e.target.value }))}
                            className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                            aria-label="Profit margin percentage"
                          />
                          <button
                            type="button"
                            onClick={() => void saveMargin(server.slug)}
                            disabled={isSaving || !inputValue.trim()}
                            className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isSaving ? "Saving..." : "Set"}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : <div className="p-5 text-sm font-semibold text-slate-500">No logs servers configured.</div>}
          </section>



          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-emerald-600" /><h3 className="text-lg font-black tracking-tight text-slate-900">Email broadcast</h3></div>
                <p className="mt-1 text-xs font-semibold text-slate-500">Send a one-off email or broadcast to all verified users.</p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {broadcastProgress ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 truncate">{broadcastSubject || "Broadcast"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {broadcastProgress.status === "paused"
                          ? `Paused at daily limit — resumes automatically. ${broadcastProgress.sent}/${broadcastProgress.total} sent`
                          : broadcastProgress.status === "processing"
                          ? `Sending chunk ${broadcastProgress.currentChunk + 1}... ${broadcastProgress.sent}/${broadcastProgress.total} (${broadcastProgress.progress}%)`
                          : broadcastProgress.status === "done"
                          ? `Done. Sent ${broadcastProgress.sent}, failed ${broadcastProgress.failed}`
                          : broadcastProgress.status === "failed"
                          ? `Failed. Sent ${broadcastProgress.sent}, failed ${broadcastProgress.failed}`
                          : `Queued — ${broadcastProgress.total} recipients`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {broadcastProgress.status === "paused" || broadcastProgress.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => void resumeBroadcast(broadcastProgress.id)}
                          disabled={busyBroadcastId === broadcastProgress.id}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {busyBroadcastId === broadcastProgress.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Resume
                        </button>
                      ) : broadcastProgress.status === "processing" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBroadcastProgress(null);
                            setBroadcastMessageText("");
                            setBroadcastStatus("idle");
                          }}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:text-rose-700"
                        >
                          <X className="h-4 w-4" /> Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${Math.min(broadcastProgress.progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                    <span className="flex-1 min-w-[120px]">Total: <span className="font-black text-slate-900">{broadcastProgress.total}</span></span>
                    <span className="text-emerald-600">Sent: <span className="font-black">{broadcastProgress.sent}</span></span>
                    <span className="text-rose-600">Failed: <span className="font-black">{broadcastProgress.failed}</span></span>
                  </div>
                  {broadcastMessageText && (
                    <div className="rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-600">{broadcastMessageText}</div>
                  )}
                  {broadcastProgress.chunks.length > 1 && (
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1">
                        Chunks ({broadcastProgress.chunks.length})
                        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 grid gap-1 text-xs">
                        {broadcastProgress.chunks.map((chunk, index) => (
                          <div
                            key={index}
                            className={`flex items-center gap-2 px-2 py-1 rounded ${
                              chunk.status === "done" ? "bg-emerald-50" :
                              chunk.status === "processing" ? "bg-blue-50" :
                              chunk.status === "paused" ? "bg-amber-50" :
                              chunk.status === "failed" ? "bg-rose-50" : "bg-slate-50"
                            }`}
                          >
                            <span className="w-8 text-center font-bold">{index + 1}</span>
                            <span className="flex-1 text-left truncate">{chunk.status}</span>
                            <span className="text-emerald-600">{chunk.sent}/{chunk.total}</span>
                            {chunk.failed > 0 && <span className="text-rose-600">failed {chunk.failed}</span>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.1em] text-slate-400 mb-2">Mode</label>
                      <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="broadcastMode"
                            value="single"
                            checked={broadcastMode === "single"}
                            onChange={() => setBroadcastMode("single")}
                            className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-sm font-semibold text-slate-700">Single user</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="broadcastMode"
                            value="all"
                            checked={broadcastMode === "all"}
                            onChange={() => setBroadcastMode("all")}
                            className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-sm font-semibold text-slate-700">All verified users</span>
                        </label>
                      </div>
                    </div>

                    {broadcastMode === "single" && (
                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.1em] text-slate-400 mb-1">Recipient email</label>
                        <input
                          type="email"
                          value={broadcastEmail}
                          onChange={(event) => setBroadcastEmail(event.target.value)}
                          placeholder="user@example.com"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.1em] text-slate-400 mb-1">Subject</label>
                      <input
                        type="text"
                        value={broadcastSubject}
                        onChange={(event) => setBroadcastSubject(event.target.value)}
                        placeholder="Announcing a new feature"
                        maxLength={200}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.1em] text-slate-400 mb-1">Message (plain text, will be wrapped in light HTML)</label>
                      <textarea
                        value={broadcastMessage}
                        onChange={(event) => setBroadcastMessage(event.target.value)}
                        placeholder="Hi {{name}},

We're excited to announce..."
                        rows={6}
                        maxLength={5000}
                        className="h-32 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 resize-none font-mono"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.1em] text-slate-400 mb-1">CTA label (optional)</label>
                        <input
                          type="text"
                          value={broadcastCtaLabel}
                          onChange={(event) => setBroadcastCtaLabel(event.target.value)}
                          placeholder="View dashboard"
                          maxLength={60}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.1em] text-slate-400 mb-1">CTA URL (optional)</label>
                        <input
                          type="text"
                          value={broadcastCtaUrl}
                          onChange={(event) => setBroadcastCtaUrl(event.target.value)}
                          placeholder="/dashboard or https://example.com"
                          maxLength={500}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    {broadcastMessageText && (
                      <div className={`rounded-lg p-3 text-xs font-semibold ${broadcastStatus === "error" ? "bg-rose-50 text-rose-800" : "bg-blue-50 text-blue-800"}`}>
                        {broadcastMessageText}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => void sendBroadcast()}
                        disabled={broadcastStatus === "sending" || broadcastStatus === "polling" || !broadcastSubject.trim() || !broadcastMessage.trim() || (broadcastMode === "single" && !broadcastEmail.trim())}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                        {broadcastStatus === "sending" || broadcastStatus === "polling" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {broadcastStatus === "sending" ? "Sending..." : broadcastMode === "all" ? "Send to everyone" : "Send to user"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {broadcastHistory.length > 0 && (
                <details className="group mt-6">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.1em] text-slate-400 hover:text-slate-600 flex items-center gap-1">
                    Recent broadcasts
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 divide-y divide-slate-100">
                    {broadcastHistory.map((b) => (
                      <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 truncate">{b.subject}</p>
                          <p className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                              b.status === "done" ? "bg-emerald-50 text-emerald-700" :
                              b.status === "failed" ? "bg-rose-50 text-rose-700" :
                              b.status === "paused" ? "bg-amber-50 text-amber-700" :
                              "bg-slate-50 text-slate-700"
                            }`}>
                              {b.status}
                            </span>
                            <span>{b.sent}/{b.total} sent ({b.progress}%)</span>
                            <span>{b.mode === "all" ? "All users" : "Single"}</span>
                            <span>{new Date(b.createdAt).toLocaleString()}</span>
                          </p>
                        </div>
                        {(b.status === "processing" || b.status === "queued" || b.status === "paused") && (
                          <button
                            type="button"
                            onClick={() => void pollBroadcast(b.id)}
                            disabled={busyBroadcastId === b.id}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-60"
                          >
                            {busyBroadcastId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />} Poll
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </section>


          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-blue-600" /><h3 className="text-lg font-black tracking-tight text-slate-900">Purchase activity</h3></div>
                <p className="mt-1 text-xs font-semibold text-slate-500">Latest 150 orders across all users.</p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={activityQuery} onChange={(event) => setActivityQuery(event.target.value)} placeholder="Search user, order or service" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />
                </label>
                <select value={activityStatus} onChange={(event) => setActivityStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                  {["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED", "CANCELLED"].map((status) => <option key={status} value={status}>{status === "ALL" ? "All statuses" : status}</option>)}
                </select>
              </div>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  <tr><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Purchase</th><th className="px-5 py-4">Provider</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Date</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActivities.map((activity) => (
                    <tr key={activity.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><div><div className="font-black text-slate-900">{activity.user.name}</div><div className="mt-1 text-xs font-semibold text-slate-500">{activity.user.email}</div></div><button type="button" disabled={!activity.user.id || busyUserId === activity.user.id} onClick={() => void updateUser(activity.user.id, { status: activity.user.status === "banned" ? "active" : "banned" })} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black disabled:opacity-60 ${activity.user.status === "banned" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white hover:bg-rose-700"}`}><Ban className="h-3.5 w-3.5" />{busyUserId === activity.user.id ? "Updating..." : activity.user.status === "banned" ? "Unban" : "Ban user"}</button></div></td>
                      <td className="px-5 py-4"><div className="font-black text-slate-900">{activity.serviceName}</div><div className="mt-1 text-xs font-semibold capitalize text-slate-500">{activity.orderNumber} · {activity.kind} · Qty {activity.quantity}</div></td>
                      <td className="px-5 py-4 font-bold text-slate-700">{activity.provider}</td>
                      <td className="px-5 py-4 font-black text-slate-900">{activity.amount}</td>
                      <td className="px-5 py-4"><StatusPill status={activity.status} /></td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-500">{formatDateTime(activity.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {filteredActivities.map((activity) => (
                <article key={activity.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black text-blue-600">{activity.orderNumber}</p><h4 className="mt-1 truncate font-black text-slate-900">{activity.serviceName}</h4></div><StatusPill status={activity.status} /></div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-blue-600 ring-1 ring-slate-200"><ShoppingBag className="h-4 w-4" /></span><div><p className="font-black text-slate-900">{activity.user.name}</p><p className="text-xs font-semibold text-slate-500">{activity.user.email}</p></div></div><button type="button" disabled={!activity.user.id || busyUserId === activity.user.id} onClick={() => void updateUser(activity.user.id, { status: activity.user.status === "banned" ? "active" : "banned" })} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black disabled:opacity-60 ${activity.user.status === "banned" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}><Ban className="h-4 w-4" />{busyUserId === activity.user.id ? "Updating..." : activity.user.status === "banned" ? "Unban" : "Ban user"}</button></div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><span><b>Amount</b><br />{activity.amount}</span><span><b>Provider</b><br />{activity.provider}</span><span><b>Quantity</b><br />{activity.quantity}</span><span><b>Date</b><br />{formatDateTime(activity.createdAt)}</span></div>
                </article>
              ))}
            </div>
            {!filteredActivities.length ? <div className="border-t border-slate-100 p-8 text-center text-sm font-bold text-slate-500">No purchase activity matches these filters.</div> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function PricingInput({ label, value, onChange, prefix, suffix, step = "1", help }: { label: string; value: number; onChange: (value: string) => void; prefix?: string; suffix?: string; step?: string; help?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-700">{label}</span>
      <span className="mt-2 flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
        {prefix ? <span className="pl-3 text-sm font-black text-slate-500">{prefix}</span> : null}
        <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-black text-slate-900 outline-none" />
        {suffix ? <span className="pr-3 text-sm font-black text-slate-500">{suffix}</span> : null}
      </span>
      {help ? <span className="mt-1.5 block text-[11px] font-semibold leading-4 text-slate-500">{help}</span> : null}
    </label>
  );
}
