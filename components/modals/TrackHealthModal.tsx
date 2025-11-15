"use client";

import { useEffect } from "react";

interface TrackHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  onOpenSettings: () => void;
}

export default function TrackHealthModal({
  isOpen,
  onClose,
  onContinue,
  onOpenSettings,
}: TrackHealthModalProps) {

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleContinue = () => {
    onClose();
    onContinue();
  };

  // Sample health progress data over time (weeks)
  const healthData = [
    { week: "W1", bmi: 28.5, weight: 85, healthScore: 65 },
    { week: "W2", bmi: 27.8, weight: 83, healthScore: 68 },
    { week: "W3", bmi: 27.2, weight: 81, healthScore: 72 },
    { week: "W4", bmi: 26.5, weight: 79, healthScore: 75 },
    { week: "W5", bmi: 25.9, weight: 77, healthScore: 78 },
    { week: "W6", bmi: 25.2, weight: 75, healthScore: 82 },
    { week: "W7", bmi: 24.8, weight: 74, healthScore: 85 },
  ];

  // Normalize health score to 0-100 scale for graph
  const maxHealthScore = 100;
  const minHealthScore = 0;
  
  // Calculate average health score
  const avgHealthScore = Math.round(healthData.reduce((sum, d) => sum + d.healthScore, 0) / healthData.length);
  
  // Get BMI range for context
  const currentBMI = healthData[healthData.length - 1].bmi;
  const startingBMI = healthData[0].bmi;
  const bmiChange = (startingBMI - currentBMI).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={handleBackdropClick}
    >
      <div
        className="pixel-modal-glass p-8 max-w-4xl w-full mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl pixel-close-button"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          ×
        </button>

        {/* Title */}
        <div className="text-center mb-8">
          <h2
            className="text-3xl mb-4 text-white"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            TRACK YOUR HEALTH
          </h2>
          <p className="text-white opacity-70" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px", lineHeight: "1.6" }}>
            ENTER YOUR DATA TO CALCULATE BMI & BMR
          </p>
        </div>

        {/* Two sections side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Left section - Data needed */}
          <div className="flex flex-col">
            <div className="mb-6">
              <h3
                className="text-lg mb-5 text-white"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                DATA NEEDED
              </h3>
              <ul className="space-y-4 text-white" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px", lineHeight: "2" }}>
                <li className="flex items-center gap-3">
                  <span className="text-cyan-400">▸</span>
                  <span>HEIGHT (CM/FT)</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-cyan-400">▸</span>
                  <span>WEIGHT (KG/LBS)</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-cyan-400">▸</span>
                  <span>AGE (YEARS)</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-cyan-400">▸</span>
                  <span>GENDER</span>
                </li>
              </ul>
            </div>
            
            <div className="pixel-modal-glass p-4 flex-1 flex flex-col">
              <p className="text-cyan-400 mb-3" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px" }}>
                WHAT WE CALCULATE
              </p>
              <ul className="space-y-2 text-white" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", lineHeight: "1.8" }}>
                <li>• BMI: BODY MASS INDEX</li>
                <li>• BMR: BASAL METABOLIC RATE</li>
                <li>• CALORIES: BURNT DURING GAME</li>
              </ul>
            </div>
          </div>

          {/* Right section - Health Progress Graph */}
          <div className="flex flex-col">
            <h3
              className="text-lg mb-5 text-white"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              HEALTH PROGRESS
            </h3>
            <div className="pixel-modal-glass p-4 flex-1">
              {/* Health progress line graph */}
              <div className="relative h-52 mb-4" style={{ imageRendering: "pixelated" }}>
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between opacity-20">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-px bg-white" style={{ width: "100%" }}></div>
                  ))}
                </div>
                
                {/* Y-axis labels (Health Score 0-100) */}
                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between pr-2">
                  {[100, 75, 50, 25, 0].map((value) => (
                    <span
                      key={value}
                      className="text-white opacity-60"
                      style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}
                    >
                      {value}
                    </span>
                  ))}
                </div>

                {/* Graph area with padding to prevent cutoff */}
                <div className="absolute left-10 right-4 top-2 bottom-10">
                  {/* Health Score line */}
                  <svg className="w-full h-full" style={{ imageRendering: "pixelated", overflow: "visible" }} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                    {/* Area under curve for visual appeal */}
                    <defs>
                      <linearGradient id="healthGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#4ECDC4" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#4ECDC4" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points={`0,100 ${healthData.map((data, index) => {
                        const x = (index / (healthData.length - 1)) * 100;
                        const y = 100 - ((data.healthScore / maxHealthScore) * 100);
                        return `${x},${y}`;
                      }).join(' ')} 100,100`}
                      fill="url(#healthGradient)"
                    />
                    {/* Line path connecting all dots */}
                    <polyline
                      points={healthData.map((data, index) => {
                        const x = (index / (healthData.length - 1)) * 100;
                        const y = 100 - ((data.healthScore / maxHealthScore) * 100);
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#4ECDC4"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ imageRendering: "pixelated" }}
                    />
                    {/* Data points */}
                    {healthData.map((data, index) => {
                      const x = (index / (healthData.length - 1)) * 100;
                      const y = 100 - ((data.healthScore / maxHealthScore) * 100);
                      return (
                        <g key={index}>
                          <circle
                            cx={x}
                            cy={y}
                            r="3"
                            fill="#4ECDC4"
                            stroke="#ffffff"
                            strokeWidth="2"
                            style={{ imageRendering: "pixelated" }}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* X-axis labels */}
                <div className="absolute bottom-0 left-10 right-4 flex justify-between pt-2">
                  {healthData.map((data, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <span
                        className="text-white"
                        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}
                      >
                        {data.week}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Health stats summary */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white border-opacity-20">
                <div className="text-center">
                  <p className="text-cyan-400 mb-1" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                    SCORE
                  </p>
                  <p className="text-white" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px" }}>
                    {currentBMI.toFixed(1)}
                  </p>
                  <p className="text-white opacity-60 mt-1" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
                    BMI
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-cyan-400 mb-1" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                    CHANGE
                  </p>
                  <p className="text-green-400" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px" }}>
                    -{bmiChange}
                  </p>
                  <p className="text-white opacity-60 mt-1" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
                    IMPROVED
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-cyan-400 mb-1" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                    HEALTH
                  </p>
                  <p className="text-white" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px" }}>
                    {avgHealthScore}%
                  </p>
                  <p className="text-white opacity-60 mt-1" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
                    AVG SCORE
                  </p>
                </div>
              </div>

              <p
                className="text-white opacity-70 text-center mt-3"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", lineHeight: "1.6" }}
              >
                7-WEEK HEALTH PROGRESS TRACKING
              </p>
            </div>
          </div>
        </div>

        {/* Additional info section */}
        <div className="pixel-modal-glass p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-cyan-400 mb-3" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px" }}>
                BMI RANGES
              </p>
              <ul className="space-y-1.5 text-white" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", lineHeight: "1.8" }}>
                <li>UNDERWEIGHT: &lt;18.5</li>
                <li>NORMAL: 18.5-24.9</li>
                <li>OVERWEIGHT: 25-29.9</li>
                <li>OBESE: ≥30</li>
              </ul>
            </div>
            <div>
              <p className="text-cyan-400 mb-3" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px" }}>
                BMR EXPLANATION
              </p>
              <p className="text-white" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", lineHeight: "1.8" }}>
                BMR IS YOUR RESTING METABOLIC RATE. WE USE IT AS A BASE AND ADD YOUR GAME ACTIVITY TO CALCULATE TOTAL CALORIES BURNT.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons - bottom */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="pixel-button-glass"
          >
            ENTER DATA
          </button>
          <button
            onClick={handleContinue}
            className="pixel-button-glass"
          >
            CONTINUE
          </button>
        </div>
      </div>
    </div>
  );
}

