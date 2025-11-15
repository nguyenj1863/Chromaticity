"use client";

import { useEffect } from "react";
import { useStore } from "@/app/store/useStore";

interface PlayerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlayer: (player: 1 | 2) => void;
}

export default function PlayerSelectionModal({
  isOpen,
  onClose,
  onSelectPlayer,
}: PlayerSelectionModalProps) {
  const { player1, player2 } = useStore();

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

  const handlePlayerSelect = (player: 1 | 2) => {
    onSelectPlayer(player);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={handleBackdropClick}
    >
      <div
        className="pixel-modal-glass p-8 max-w-3xl w-full mx-4 relative"
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
            className="text-2xl mb-3 text-white"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            SELECT PLAYER
          </h2>
          <p className="text-white opacity-70" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px", lineHeight: "1.6" }}>
            CHOOSE WHICH PLAYER DATA TO USE FOR SOLO MODE
          </p>
        </div>

        {/* Player buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Player 1 */}
          <button
            onClick={() => handlePlayerSelect(1)}
            className="pixel-modal-glass p-6 hover:bg-opacity-20 transition-all cursor-pointer text-left group"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-3 h-3 bg-cyan-400" style={{ imageRendering: "pixelated" }}></div>
                <span className="text-cyan-400" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "14px" }}>
                  PLAYER 1
                </span>
              </div>
              {player1.height && player1.weight && player1.age && player1.gender ? (
                <div className="space-y-3 text-white flex-1" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px", lineHeight: "2" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400">▸</span>
                    <span>HEIGHT: {player1.height} CM</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400">▸</span>
                    <span>WEIGHT: {player1.weight} KG</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400">▸</span>
                    <span>AGE: {player1.age} YEARS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400">▸</span>
                    <span>GENDER: {player1.gender.toUpperCase()}</span>
                  </div>
                </div>
              ) : (
                <div className="text-white opacity-60 flex-1 flex items-center justify-center" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                  NO DATA AVAILABLE
                </div>
              )}
            </div>
          </button>

          {/* Player 2 */}
          <button
            onClick={() => handlePlayerSelect(2)}
            className="pixel-modal-glass p-6 hover:bg-opacity-20 transition-all cursor-pointer text-left group"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-3 h-3 bg-cyan-400" style={{ imageRendering: "pixelated" }}></div>
                <span className="text-cyan-400" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "14px" }}>
                  PLAYER 2
                </span>
              </div>
              {player2.height && player2.weight && player2.age && player2.gender ? (
                <div className="space-y-3 text-white flex-1" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px", lineHeight: "2" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400">▸</span>
                    <span>HEIGHT: {player2.height} CM</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400">▸</span>
                    <span>WEIGHT: {player2.weight} KG</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400">▸</span>
                    <span>AGE: {player2.age} YEARS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400">▸</span>
                    <span>GENDER: {player2.gender.toUpperCase()}</span>
                  </div>
                </div>
              ) : (
                <div className="text-white opacity-60 flex-1 flex items-center justify-center" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                  NO DATA AVAILABLE
                </div>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

