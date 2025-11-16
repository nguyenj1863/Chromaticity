"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CaloriePoint {
  sessionId: string;
  eventTime: string;
  caloriesTotal: number;
}

const SAMPLE_CALORIE_DATA: CaloriePoint[] = [
  { sessionId: "sample", eventTime: new Date("2025-02-14T10:00:00Z").toISOString(), caloriesTotal: 5 },
  { sessionId: "sample", eventTime: new Date("2025-02-14T10:05:00Z").toISOString(), caloriesTotal: 9 },
  { sessionId: "sample", eventTime: new Date("2025-02-14T10:10:00Z").toISOString(), caloriesTotal: 15 },
  { sessionId: "sample", eventTime: new Date("2025-02-14T10:15:00Z").toISOString(), caloriesTotal: 21 },
  { sessionId: "sample", eventTime: new Date("2025-02-14T10:20:00Z").toISOString(), caloriesTotal: 28 },
];

export default function AnalyticsModal({ isOpen, onClose }: AnalyticsModalProps) {
  const [calorieData, setCalorieData] = useState<CaloriePoint[]>(SAMPLE_CALORIE_DATA);
  const [usingSampleData, setUsingSampleData] = useState(true);
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchCalorieData();
  }, [isOpen]);

  const fetchCalorieData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/calories");
      const data = await response.json();
      if (response.ok) {
        const rows: CaloriePoint[] = (data.data ?? []).reverse();
        if (rows.length > 0) {
          setCalorieData(rows);
          setUsingSampleData(false);
        } else {
          setCalorieData(SAMPLE_CALORIE_DATA);
          setUsingSampleData(true);
        }
      } else {
        setError(data.error || "Failed to load calorie data.");
        setCalorieData(SAMPLE_CALORIE_DATA);
        setUsingSampleData(true);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load calorie data.");
      setCalorieData(SAMPLE_CALORIE_DATA);
      setUsingSampleData(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInsights = async () => {
    setInsightsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analytics");
      const data = await response.json();
      if (response.ok) {
        setInsights(data.insights ?? []);
      } else {
        setInsights([
          "Sample insight: longer play sessions steadily increased your calorie burn.",
          "Tip: keep a consistent jump rhythm to maintain optimal intensity.",
        ]);
        setError(data.error || "Failed to load Snowflake insights; showing sample data.");
      }
    } catch (err) {
      console.error(err);
      setInsights([
        "Sample insight: longer play sessions steadily increased your calorie burn.",
        "Tip: keep a consistent jump rhythm to maintain optimal intensity.",
      ]);
      setError("Failed to load insights; showing sample data.");
    } finally {
      setInsightsLoading(false);
    }
  };

  if (!isOpen) return null;

  const chartData =
    calorieData.length > 0
      ? calorieData.map((point) => ({
          time: new Date(point.eventTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          calories: Number(point.caloriesTotal.toFixed(2)),
        }))
      : [
          { time: "10:00", calories: 12 },
          { time: "10:05", calories: 18 },
          { time: "10:10", calories: 24 },
          { time: "10:15", calories: 31 },
          { time: "10:20", calories: 40 },
        ];
  const totalCalories = chartData[chartData.length - 1]?.calories ?? 0;
  const totalSessions = new Set(calorieData.map((c) => c.sessionId)).size || 1;
  const lastEntryTime = chartData[chartData.length - 1]?.time ?? "--:--";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur" onClick={onClose} />
      <div className="relative max-w-5xl w-full max-h-[90vh] overflow-y-auto glass-panel border border-white/20 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl text-white tracking-[0.2em]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            ANALYTICS
          </h2>
          <button
            onClick={onClose}
            className="pixel-button-glass px-4 py-1 text-xs"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            CLOSE
          </button>
        </div>

        <div className="bg-white/5 border border-white/20 rounded-lg p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between text-sm text-white" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            <span>CALORIES OVER TIME</span>
            <button
              onClick={fetchCalorieData}
              className="pixel-button-glass px-2 py-1 text-[10px]"
            >
              REFRESH
            </button>
          </div>
          {isLoading && <p className="text-gray-400 text-xs">Fetching Snowflake data...</p>}
          <div className="w-full h-72">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" tick={{ fill: "#fff", fontSize: 10 }} />
                <YAxis tick={{ fill: "#fff", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #555", color: "#fff" }} />
                <Line type="monotone" dataKey="calories" stroke="#4ade80" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 border border-white/20 rounded-lg p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between text-sm text-white" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            <span>AI INSIGHTS (GEMINI)</span>
            <button
              onClick={fetchInsights}
              className="pixel-button-glass px-2 py-1 text-[10px]"
              disabled={insightsLoading}
            >
              {insightsLoading ? "LOADING..." : "GENERATE"}
            </button>
          </div>
          {insights.length === 0 ? (
            <p className="text-gray-300 text-sm">
              {insightsLoading
                ? "Generating insights..."
                : "No data synced yet. Try generating after a sample session."}
            </p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-100">
              {insights.map((insight, index) => (
                <li key={index} className="leading-relaxed">
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}

