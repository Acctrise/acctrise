import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { User } from "@/models/user";
import { getRequestUser } from "@/lib/auth/request";
import { hasRole } from "@/lib/auth/roles";

async function requireAdmin(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasRole(user.role, "ADMIN")) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

/**
 * GET /api/admin/users/signups
 * Query params:
 * - date: ISO date string (YYYY-MM-DD) - the reference date, defaults to today
 * - days: number - number of days to fetch (default 30, max 365)
 * - granularity: "day" | "week" | "month" (default "day")
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  await connectMongo();

  const searchParams = request.nextUrl.searchParams;
  const dateParam = searchParams.get("date");
  const daysParam = searchParams.get("days");
  const granularity = searchParams.get("granularity") || "day";

  // Parse reference date (default to today in UTC)
  const referenceDate = dateParam ? new Date(dateParam + "T00:00:00.000Z") : new Date();
  referenceDate.setUTCHours(0, 0, 0, 0);

  // Parse days (default 30, max 365)
  const days = Math.min(Math.max(parseInt(daysParam || "30", 10), 1), 365);

  // Calculate start date (inclusive)
  const startDate = new Date(referenceDate);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  // Calculate end date (exclusive - next day after reference)
  const endDate = new Date(referenceDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  // Build aggregation pipeline based on granularity
  let groupId: any;
  let dateFormat: string;

  switch (granularity) {
    case "week":
      groupId = {
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" }
      };
      dateFormat = "%Y-W%U";
      break;
    case "month":
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      };
      dateFormat = "%Y-%m";
      break;
    case "day":
    default:
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" }
      };
      dateFormat = "%Y-%m-%d";
      break;
  }

  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lt: endDate
        }
      }
    },
    {
      $group: {
        _id: groupId,
        count: { $sum: 1 },
        // Also get the first date in each group for sorting
        firstDate: { $first: "$createdAt" }
      }
    },
    {
      $sort: { "firstDate": 1 as const }
    }
  ];

  const results = await User.aggregate(pipeline);

  // Build a complete date range with zero-filled gaps
  const dataPoints: Array<{
    date: string;
    label: string;
    count: number;
    isCurrentPeriod: boolean;
  }> = [];

  let currentDate = new Date(startDate);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Create a map for quick lookup
  const resultsMap = new Map<string, number>();
  results.forEach((r: any) => {
    let key: string;
    if (granularity === "day") {
      key = `${r._id.year}-${String(r._id.month).padStart(2, "0")}-${String(r._id.day).padStart(2, "0")}`;
    } else if (granularity === "week") {
      key = `${r._id.year}-W${String(r._id.week).padStart(2, "0")}`;
    } else {
      key = `${r._id.year}-${String(r._id.month).padStart(2, "0")}`;
    }
    resultsMap.set(key, r.count);
  });

  // Generate complete range
  while (currentDate < endDate) {
    let key: string;
    let label: string;
    let nextDate: Date;

    if (granularity === "day") {
      key = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, "0")}-${String(currentDate.getUTCDate()).padStart(2, "0")}`;
      label = currentDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
      nextDate = new Date(currentDate);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    } else if (granularity === "week") {
      // Get start of week (Sunday)
      const weekStart = new Date(currentDate);
      const dayOfWeek = weekStart.getUTCDay();
      weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek);
      weekStart.setUTCHours(0, 0, 0, 0);

      key = `${weekStart.getUTCFullYear()}-W${String(Math.ceil((weekStart.getUTCDate() + 6) / 7)).padStart(2, "0")}`;
      label = `${weekStart.toLocaleDateString("en-NG", { month: "short", day: "numeric" })} - ${new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`;

      nextDate = new Date(weekStart);
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
      currentDate = weekStart; // Align to week start
    } else {
      // month
      key = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, "0")}`;
      label = currentDate.toLocaleDateString("en-NG", { month: "short", year: "numeric" });
      nextDate = new Date(currentDate);
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
    }

    const count = resultsMap.get(key) || 0;
    const isCurrentPeriod = currentDate.getTime() === today.getTime();

    dataPoints.push({
      date: key,
      label,
      count,
      isCurrentPeriod
    });

    currentDate.setTime(nextDate.getTime());
  }

  // Calculate summary stats
  const totalSignups = dataPoints.reduce((sum, dp) => sum + dp.count, 0);
  const todaySignups = dataPoints.find(dp => dp.isCurrentPeriod)?.count || 0;

  // This week signups (last 7 days)
  const weekAgo = new Date(referenceDate);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
  const thisWeekSignups = dataPoints
    .filter(dp => new Date(dp.date + "T00:00:00.000Z") >= weekAgo)
    .reduce((sum, dp) => sum + dp.count, 0);

  // This month signups
  const monthStart = new Date(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1);
  const thisMonthSignups = dataPoints
    .filter(dp => new Date(dp.date + "T00:00:00.000Z") >= monthStart)
    .reduce((sum, dp) => sum + dp.count, 0);

  // Previous period comparison
  const prevPeriodStart = new Date(startDate);
  prevPeriodStart.setUTCDate(prevPeriodStart.getUTCDate() - days);
  const prevPeriodEnd = new Date(startDate);
  prevPeriodEnd.setUTCDate(prevPeriodEnd.getUTCDate() - 1);

  const prevPeriodResults = await User.countDocuments({
    createdAt: {
      $gte: prevPeriodStart,
      $lte: prevPeriodEnd
    }
  });

  const growthRate = prevPeriodResults > 0
    ? ((totalSignups - prevPeriodResults) / prevPeriodResults) * 100
    : totalSignups > 0 ? 100 : 0;

  return NextResponse.json({
    success: true,
    data: {
      granularity,
      referenceDate: referenceDate.toISOString().split("T")[0],
      days,
      dataPoints,
      summary: {
        totalSignups,
        todaySignups,
        thisWeekSignups,
        thisMonthSignups,
        previousPeriodSignups: prevPeriodResults,
        growthRate: Math.round(growthRate * 100) / 100
      },
      navigation: {
        previousDate: new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        nextDate: referenceDate.toISOString().split("T")[0] === today.toISOString().split("T")[0]
          ? null
          : new Date(referenceDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        today: today.toISOString().split("T")[0]
      }
    }
  });
}