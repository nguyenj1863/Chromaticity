"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/app/store/useStore";
import TrackHealthModal from "@/components/modals/TrackHealthModal";
import BMISettingsModal from "@/components/modals/BMISettingsModal";
import PlayerSelectionModal from "@/components/modals/PlayerSelectionModal";
import HowToPlayModal from "@/components/modals/HowToPlayModal";

interface MenuButtonProps {
  label: string;
  onClick?: () => void;
  description?: string;
}

function MenuButton({ label, onClick, description }: MenuButtonProps) {
  return (
    <button
      className="pixel-button-glass"
      onClick={onClick}
      title={description}
    >
      {label}
    </button>
  );
}

interface MenuButtonsProps {
  onGameStart?: () => void;
}

export default function MenuButtons({ onGameStart }: MenuButtonsProps) {
  const router = useRouter();
  const { player1, player2 } = useStore();
  const [showTrackHealthModal, setShowTrackHealthModal] = useState(false);
  const [showBMIModal, setShowBMIModal] = useState(false);
  const [showPlayerSelectionModal, setShowPlayerSelectionModal] = useState(false);
  const [showHowToPlayModal, setShowHowToPlayModal] = useState(false);

  const hasPlayer1Data = player1.height && player1.weight && player1.age && player1.gender;
  const hasPlayer2Data = player2.height && player2.weight && player2.age && player2.gender;
  const hasMultiplePlayers = hasPlayer1Data && hasPlayer2Data;

  const handleSoloClick = () => {
    if (!hasPlayer1Data && !hasPlayer2Data) {
      // No data at all - show track health modal
      setShowTrackHealthModal(true);
    } else if (hasMultiplePlayers) {
      // Both players have data - show selection modal
      setShowPlayerSelectionModal(true);
    } else {
      // Only one player has data - show how to play modal
      setShowHowToPlayModal(true);
    }
  };

  const handleContinue = () => {
    setShowTrackHealthModal(false);
    setShowHowToPlayModal(true);
  };

  const handleOpenSettings = () => {
    setShowBMIModal(true);
  };

  const handlePlayerSelect = (player: 1 | 2) => {
    // Store selected player for solo mode (you can extend the store if needed)
    setShowPlayerSelectionModal(false);
    setShowHowToPlayModal(true);
  };

  const buttons = [
    {
      label: "SOLO",
      onClick: handleSoloClick,
      description: "Start solo game",
    },
    {
      label: "MULTIPLAYER",
      onClick: () => router.push("/multiplayer"),
      description: "Start multiplayer game (up to 2 players)",
    },
    {
      label: "ANALYTICS",
      onClick: () => router.push("/analytics"),
      description: "View game analytics",
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-8 items-center mt-12 md:mt-16">
        {buttons.map((button) => (
          <MenuButton
            key={button.label}
            label={button.label}
            onClick={button.onClick}
            description={button.description}
          />
        ))}
      </div>

      <TrackHealthModal
        isOpen={showTrackHealthModal}
        onClose={() => setShowTrackHealthModal(false)}
        onContinue={handleContinue}
        onOpenSettings={handleOpenSettings}
      />
      
      <BMISettingsModal
        isOpen={showBMIModal}
        onClose={() => setShowBMIModal(false)}
      />
      
      <PlayerSelectionModal
        isOpen={showPlayerSelectionModal}
        onClose={() => setShowPlayerSelectionModal(false)}
        onSelectPlayer={handlePlayerSelect}
      />

      <HowToPlayModal
        isOpen={showHowToPlayModal}
        onClose={() => setShowHowToPlayModal(false)}
        onConnectController={() => {
          setShowHowToPlayModal(false);
          onGameStart?.();
        }}
        onConnectCamera={() => {
          setShowHowToPlayModal(false);
          onGameStart?.();
        }}
      />
    </>
  );
}

