import { NextRequest, NextResponse } from "next/server";
import { insertCalorieLog, fetchRecentCalories, snowflakeReady } from "@/lib/snowflake";

export async function POST(request: NextRequest) {
  if (!snowflakeReady) {
    return NextResponse.json(
      { error: "Snowflake is not configured; skipping logging." },
      { status: 501 }
    );
  }

  try {
    const body = await request.json();
    const { sessionId, deltaCalories, totalCalories, timestamp } = body || {};

    if (
      typeof sessionId !== "string" ||
      typeof deltaCalories !== "number" ||
      typeof totalCalories !== "number"
    ) {
      return NextResponse.json(
        { error: "sessionId, deltaCalories, and totalCalories are required." },
        { status: 400 }
      );
    }

    await insertCalorieLog({
      sessionId,
      deltaCalories,
      totalCalories,
      eventTime: new Date(timestamp ?? Date.now()),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log calories:", error);
    return NextResponse.json({ error: "Failed to log calories." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const rows = await fetchRecentCalories(150);
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("Failed to fetch calories:", error);
    return NextResponse.json({ error: "Failed to fetch calorie data." }, { status: 500 });
  }
}

