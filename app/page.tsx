"use client";

import { useState } from "react";
import BackgroundEffects from "@/components/home/BackgroundEffects";
import TitleSection from "@/components/home/TitleSection";
import MenuButtons from "@/components/home/MenuButtons";
import SettingsButton from "@/components/home/SettingsButton";
import SoloGame from "@/components/game/SoloGame";

export default function Home() {
  const [showGame, setShowGame] = useState(false);
  const title = "CHROMATICITY";
  const colors = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#FFA07A", // Light Salmon
    "#98D8C8", // Mint
    "#F7DC6F", // Yellow
    "#BB8FCE", // Purple
    "#85C1E2", // Sky Blue
    "#F8B739", // Orange
    "#52BE80", // Green
  ];

  // If game is showing, render game component
  if (showGame) {
    return <SoloGame onClose={() => setShowGame(false)} />;
  }

  return (
    <main className="min-h-screen bg-grey-world relative overflow-hidden">
      {/* Dark overlay background - same as modal */}
      <div className="fixed inset-0 bg-black bg-opacity-70 z-0"></div>
      
      {/* Background effects - particles need to be above the overlay */}
      <div className="fixed inset-0 z-10 pointer-events-none">
        <BackgroundEffects colors={colors} />
      </div>

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center min-h-screen">
        <TitleSection title={title} colors={colors} />
        <MenuButtons onGameStart={() => setShowGame(true)} />
        <SettingsButton />
        
        {/* Made with love text */}
        <div className="absolute bottom-8 right-8 text-right">
          <p className="text-white text-[10px] md:text-xs" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            made with love
          </p>
          <p className="text-white text-[8px] md:text-[10px] mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            ◎[▪‿▪]◎
          </p>
        </div>
      </div>
    </main>
  );
}

