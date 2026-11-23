/**
 * Development seed data.
 *
 * Creates one admin, one funded customer, a catalog entry and two sample orders
 * so login, wallet and orders screens have something to read locally.
 *
 * Runs through the native MongoDB driver (the Mongoose model files cannot be
 * imported by tsx), and every write is an upsert keyed by a stable field, so it
 * is safe to run repeatedly.
 *
 * Usage: npm run seed:dev
 * Guard: refuses to write into a database named like production unless FORCE_SEED=1.
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectMongo } from "../src/lib/mongodb";

const PROTECTED_DATABASES = new Set(["acctrise", "admin", "config", "local"]);
const SEED_PASSWORD = process.env.SEED_PASSWORD || "devpassword123";
const ADMIN_EMAIL = "admin@acctrise.local";
const CUSTOMER_EMAIL = "customer@acctrise.local";

/** Money is stored as integer cents (kobo for NGN) everywhere in this app. */
function cents(naira: number): number {
  return Math.round(naira * 100);
}

async function main() {
  const connection = await connectMongo();
  const db = connection.connection.db;
  if (!db) throw new Error("MongoDB connection has no database handle.");

  const databaseName = db.databaseName;
  if (PROTECTED_DATABASES.has(databaseName) && process.env.FORCE_SEED !== "1") {
    throw new Error(
      `Refusing to seed "${databaseName}": it looks like production. ` +
        `Point MONGODB_URI at a dev database (for example .../${databaseName}-dev) or set FORCE_SEED=1.`
    );
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const now = new Date();

  // Users -------------------------------------------------------------------
  await db.collection("users").updateOne(
    { email: ADMIN_EMAIL },
    {
      $set: {
        email: ADMIN_EMAIL,
        username: "admin",
        passwordHash,
        firstName: "Local",
        lastName: "Admin",
        role: "ADMIN",
        status: "active",
        emailVerified: now,
        lastLoginAt: null,
        lastLoginIp: null,
        lastPasswordChangeAt: null,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  await db.collection("users").updateOne(
    { email: CUSTOMER_EMAIL },
    {
      $set: {
        email: CUSTOMER_EMAIL,
        username: "customer",
        passwordHash,
        firstName: "Local",
        lastName: "Customer",
        role: "CUSTOMER",
        status: "active",
        emailVerified: now,
        lastLoginAt: null,
        lastLoginIp: null,
        lastPasswordChangeAt: null,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  const admin = await db.collection("users").findOne({ email: ADMIN_EMAIL });
  const customer = await db.collection("users").findOne({ email: CUSTOMER_EMAIL });
  if (!admin || !customer) throw new Error("Seed users were not written.");

  // Wallet ------------------------------------------------------------------
  const openedBalanceCents = cents(2500);
  await db.collection("wallets").updateOne(
    { userId: customer._id },
    {
      $setOnInsert: {
        userId: customer._id,
        balanceCents: openedBalanceCents,
        lockedBalanceCents: 0,
        totalDepositedCents: openedBalanceCents,
        totalWithdrawnCents: 0,
        bonusBalanceCents: 0,
        currency: "NGN",
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );
  const wallet = await db.collection("wallets").findOne({ userId: customer._id });
  if (!wallet) throw new Error("Seed wallet was not written.");

  await db.collection("transactions").updateOne(
    { reference: "SEED-DEPOSIT-0001" },
    {
      $setOnInsert: {
        userId: customer._id,
        walletId: wallet._id,
        orderId: null,
        type: "DEPOSIT",
        status: "COMPLETED",
        amountCents: openedBalanceCents,
        feeCents: 0,
        netAmountCents: openedBalanceCents,
        reference: "SEED-DEPOSIT-0001",
        paymentMethod: "seed",
        paymentGateway: "pocketfi",
        transactionHash: null,
        gatewayReference: null,
        description: "Seed wallet funding",
        metadata: { seeded: true },
        failureReason: null,
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  // Catalog -----------------------------------------------------------------
  await db.collection("categories").updateOne(
    { slug: "social-boosting" },
    {
      $set: { name: "Social Boosting", description: "Follower and engagement services", updatedAt: now },
      $setOnInsert: { slug: "social-boosting", icon: null, displayOrder: 0, createdAt: now }
    },
    { upsert: true }
  );
  const category = await db.collection("categories").findOne({ slug: "social-boosting" });

  await db.collection("services").updateOne(
    { slug: "instagram-followers" },
    {
      $set: {
        name: "Instagram Followers",
        description: "Seed service used by the local sample orders",
        categoryId: category!._id,
        priceCents: cents(0.56),
        minOrder: 100,
        maxOrder: 100000,
        stock: 250000,
        isActive: true,
        featured: false,
        updatedAt: now
      },
      $setOnInsert: { slug: "instagram-followers", icon: null, displayOrder: 0, createdAt: now }
    },
    { upsert: true }
  );
  const service = await db.collection("services").findOne({ slug: "instagram-followers" });
  if (!service) throw new Error("Seed service was not written.");

  // Orders ------------------------------------------------------------------
  const unitPriceCents = cents(0.56);
  const sampleOrders = [
    { orderNumber: "AC-SEED-0001", status: "COMPLETED", quantity: 1000, delivered: 1000 },
    { orderNumber: "AC-SEED-0002", status: "PROCESSING", quantity: 500, delivered: 120 }
  ];

  for (const sample of sampleOrders) {
    await db.collection("orders").updateOne(
      { orderNumber: sample.orderNumber },
      {
        $set: {
          userId: customer._id,
          serviceId: service._id,
          quantity: sample.quantity,
          unitPriceCents,
          totalPriceCents: unitPriceCents * sample.quantity,
          status: sample.status,
          targetUrl: "https://instagram.com/example",
          targetUsername: null,
          targetPhone: null,
          additionalInfo: { kind: "boosting", seeded: true },
          delivered: sample.delivered,
          startDate: now,
          completedAt: sample.status === "COMPLETED" ? now : null,
          statusMessage: sample.status === "COMPLETED" ? "Seed order delivered" : "Seed order in progress",
          retryCount: 0,
          lastRetryAt: null,
          updatedAt: now
        },
        $setOnInsert: { orderNumber: sample.orderNumber, createdAt: now }
      },
      { upsert: true }
    );
  }

  const counts = {
    users: await db.collection("users").countDocuments(),
    wallets: await db.collection("wallets").countDocuments(),
    transactions: await db.collection("transactions").countDocuments(),
    categories: await db.collection("categories").countDocuments(),
    services: await db.collection("services").countDocuments(),
    orders: await db.collection("orders").countDocuments()
  };

  console.log(
    JSON.stringify(
      {
        database: databaseName,
        password: SEED_PASSWORD,
        admin: ADMIN_EMAIL,
        customer: CUSTOMER_EMAIL,
        customerBalanceNaira: openedBalanceCents / 100,
        counts
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Seed failed" }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    const { default: mongoose } = await import("mongoose");
    await mongoose.disconnect();
  });
