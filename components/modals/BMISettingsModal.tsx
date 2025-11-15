"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/app/store/useStore";

interface BMISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MetricSystem = "canadian" | "american";

export default function BMISettingsModal({ isOpen, onClose }: BMISettingsModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2>(1);
  const [heightMetric, setHeightMetric] = useState<MetricSystem>("canadian");
  const [weightMetric, setWeightMetric] = useState<MetricSystem>("canadian");
  const [height, setHeight] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");

  const player1 = useStore((state) => state.player1);
  const player2 = useStore((state) => state.player2);
  const setPlayer1Data = useStore((state) => state.setPlayer1Data);
  const setPlayer2Data = useStore((state) => state.setPlayer2Data);

  // Conversion functions
  const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  };

  const feetInchesToCm = (feet: number, inches: number): number => {
    return (feet * 12 + inches) * 2.54;
  };

  const kgToLbs = (kg: number): number => {
    return kg * 2.20462;
  };

  const lbsToKg = (lbs: number): number => {
    return lbs / 2.20462;
  };

  // Load player data when player selection changes
  useEffect(() => {
    const playerData = selectedPlayer === 1 ? player1 : player2;
    
    // Handle height based on height metric
    if (heightMetric === "canadian") {
      setHeight(playerData.height?.toString() || "");
      setHeightFeet("");
      setHeightInches("");
    } else {
      // Convert from metric to imperial
      if (playerData.height) {
        const { feet, inches } = cmToFeetInches(playerData.height);
        setHeightFeet(feet.toString());
        setHeightInches(inches.toString());
      } else {
        setHeightFeet("");
        setHeightInches("");
      }
      setHeight("");
    }
    
    // Handle weight based on weight metric
    if (weightMetric === "canadian") {
      setWeight(playerData.weight?.toString() || "");
    } else {
      if (playerData.weight) {
        setWeight(kgToLbs(playerData.weight).toFixed(1));
      } else {
        setWeight("");
      }
    }
    
    setAge(playerData.age?.toString() || "");
    setGender(playerData.gender || "");
  }, [selectedPlayer, player1, player2, heightMetric, weightMetric]);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      return () => {
        document.removeEventListener("keydown", handleEsc);
      };
    }
  }, [isOpen, onClose]);

  // Handle click outside modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let heightInCm: number | null = null;
    let weightInKg: number | null = null;

    // Convert height based on height metric
    if (heightMetric === "canadian") {
      heightInCm = height ? parseFloat(height) : null;
    } else {
      // Convert from imperial to metric
      if (heightFeet && heightInches) {
        const feet = parseFloat(heightFeet);
        const inches = parseFloat(heightInches);
        heightInCm = feetInchesToCm(feet, inches);
      }
    }

    // Convert weight based on weight metric
    if (weightMetric === "canadian") {
      weightInKg = weight ? parseFloat(weight) : null;
    } else {
      if (weight) {
        weightInKg = lbsToKg(parseFloat(weight));
      }
    }

    const data = {
      height: heightInCm,
      weight: weightInKg,
      age: age ? parseInt(age) : null,
      gender: gender,
    };

    if (selectedPlayer === 1) {
      setPlayer1Data(data);
    } else {
      setPlayer2Data(data);
    }
    onClose();
  };

  const handleClear = () => {
    const emptyData = {
      height: null,
      weight: null,
      age: null,
      gender: "",
    };

    if (selectedPlayer === 1) {
      setPlayer1Data(emptyData);
    } else {
      setPlayer2Data(emptyData);
    }

    // Clear form fields
    setHeight("");
    setHeightFeet("");
    setHeightInches("");
    setWeight("");
    setAge("");
    setGender("");
  };

  const currentPlayerData = selectedPlayer === 1 ? player1 : player2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={handleBackdropClick}
    >
      <div
        className="pixel-modal-glass p-8 max-w-md w-full mx-4 relative"
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
        <h2
          className="text-white text-lg mb-2 text-center"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          BMI SETTINGS
        </h2>
        <p
          className="text-gray-400 text-xs mb-4 text-center"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          (OPTIONAL - FOR CALORIE TRACKING)
        </p>

        {/* Player Selection */}
        <div className="mb-6">
          <label
            className="block text-white text-xs mb-3 text-center"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            SELECT PLAYER
          </label>
          <div className="flex gap-4 justify-center">
            <button
              type="button"
              onClick={() => setSelectedPlayer(1)}
              className={`px-8 py-4 border-2 border-black transition-all ${
                selectedPlayer === 1
                  ? "bg-[#b0b0b0] text-white"
                  : "bg-gray-700 text-gray-400"
              }`}
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px" }}
            >
              PLAYER 1
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlayer(2)}
              className={`px-8 py-4 border-2 border-black transition-all ${
                selectedPlayer === 2
                  ? "bg-[#b0b0b0] text-white"
                  : "bg-gray-700 text-gray-400"
              }`}
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px" }}
            >
              PLAYER 2
            </button>
          </div>
        </div>

        {/* BMI Display */}
        {currentPlayerData.bmi && (
          <div className="mb-4 p-3 bg-gray-800 border-2 border-black text-center">
            <span
              className="text-white text-xs"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              BMI: {currentPlayerData.bmi}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Height */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label
                className="text-white text-xs"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                HEIGHT
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHeightMetric("canadian")}
                  className={`px-3 py-2 border-2 border-black transition-all ${
                    heightMetric === "canadian"
                      ? "bg-[#b0b0b0] text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}
                >
                  CM
                </button>
                <button
                  type="button"
                  onClick={() => setHeightMetric("american")}
                  className={`px-3 py-2 border-2 border-black transition-all ${
                    heightMetric === "american"
                      ? "bg-[#b0b0b0] text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}
                >
                  FT/IN
                </button>
              </div>
            </div>
            {heightMetric === "canadian" ? (
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white border-2 border-black focus:outline-none focus:border-gray-500 pixel-input"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}
                placeholder="170"
                min="0"
                max="300"
                step="0.1"
                required
              />
            ) : (
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    value={heightFeet}
                    onChange={(e) => setHeightFeet(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 text-white border-2 border-black focus:outline-none focus:border-gray-500 pixel-input"
                    style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}
                    placeholder="5"
                    min="0"
                    max="10"
                    required
                  />
                  <span
                    className="text-gray-400 text-xs mt-1 block text-center"
                    style={{ fontFamily: "'Press Start 2P', monospace" }}
                  >
                    FT
                  </span>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={heightInches}
                    onChange={(e) => setHeightInches(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 text-white border-2 border-black focus:outline-none focus:border-gray-500 pixel-input"
                    style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}
                    placeholder="10"
                    min="0"
                    max="11"
                    required
                  />
                  <span
                    className="text-gray-400 text-xs mt-1 block text-center"
                    style={{ fontFamily: "'Press Start 2P', monospace" }}
                  >
                    IN
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Weight */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label
                className="text-white text-xs"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                WEIGHT
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWeightMetric("canadian")}
                  className={`px-3 py-2 border-2 border-black transition-all ${
                    weightMetric === "canadian"
                      ? "bg-[#b0b0b0] text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}
                >
                  KG
                </button>
                <button
                  type="button"
                  onClick={() => setWeightMetric("american")}
                  className={`px-3 py-2 border-2 border-black transition-all ${
                    weightMetric === "american"
                      ? "bg-[#b0b0b0] text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}
                >
                  LBS
                </button>
              </div>
            </div>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white border-2 border-black focus:outline-none focus:border-gray-500 pixel-input"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}
              placeholder={weightMetric === "canadian" ? "70" : "154"}
              min="0"
              max={weightMetric === "canadian" ? "500" : "1100"}
              step="0.1"
              required
            />
          </div>

          {/* Age */}
          <div>
            <label
              className="block text-white text-xs mb-2"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              AGE
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white border-2 border-black focus:outline-none focus:border-gray-500 pixel-input"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}
              placeholder="25"
              min="0"
              max="150"
              required
            />
          </div>

          {/* Gender */}
          <div>
            <label
              className="block text-white text-xs mb-2"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              GENDER
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-2 py-3 bg-gray-700 text-white border-2 border-black focus:outline-none focus:border-gray-500 pixel-input"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}
              required
            >
              <option value="">SELECT</option>
              <option value="male">MALE</option>
              <option value="female">FEMALE</option>
              <option value="non-binary">NON-BINARY</option>
              <option value="genderqueer">GENDERQUEER</option>
              <option value="agender">AGENDER</option>
              <option value="bigender">BIGENDER</option>
              <option value="genderfluid">GENDERFLUID</option>
              <option value="two-spirit">TWO-SPIRIT</option>
              <option value="other">OTHER</option>
              <option value="prefer-not-to-say">PREFER NOT TO SAY</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 pixel-button-small bg-gray-600 hover:bg-gray-500"
            >
              CLEAR
            </button>
            <button
              type="submit"
              className="flex-1 pixel-button-small"
            >
              SAVE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

