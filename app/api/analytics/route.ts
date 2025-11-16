import { NextResponse } from "next/server";
import { fetchSessionSummaries, snowflakeReady } from "@/lib/snowflake";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-pro";

async function generateInsights(sessionSummaries: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return ["Gemini API key is not configured. Add GEMINI_API_KEY to enable AI insights."];
  }

  if (sessionSummaries.length === 0) {
    return ["No session data available yet. Play a session to unlock insights!"];
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `
You are assisting at a hackathon fitness game. Analyze the following session summaries:
${JSON.stringify(sessionSummaries, null, 2)}

Provide two concise bullet-point insights and one motivational tip referencing their performance.
Keep the response under 120 words.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text ? text.trim().split("\n") : ["Gemini returned an empty insight."];
  } catch (error) {
    console.error("Gemini generation error:", error);
    return ["Failed to generate AI insights. Please try again later."];
  }
}

export async function GET() {
  if (!snowflakeReady) {
    return NextResponse.json(
      { insights: ["Snowflake is not configured. Unable to load analytics."], data: [] },
      { status: 200 }
    );
  }

  try {
    const summaries = await fetchSessionSummaries(20);
    const insights = await generateInsights(summaries);
    return NextResponse.json({ data: summaries, insights });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json({ error: "Failed to load analytics." }, { status: 500 });
  }
}

