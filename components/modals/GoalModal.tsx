"use client";

import { useEffect } from "react";
import ColorCrystal3D from "@/components/ui/ColorCrystal3D";

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export default function GoalModal({
  isOpen,
  onClose,
  onContinue,
}: GoalModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={handleBackdropClick}
    >
      <div
        className="pixel-modal-glass relative w-full max-w-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="pixel-close-button absolute top-4 right-4 z-10"
          aria-label="Close"
        >
          ×
        </button>

        {/* Content */}
        <div className="p-8 md:p-12">
          {/* Title */}
          <h2
            className="text-2xl md:text-3xl text-white mb-6 text-center"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            GOAL
          </h2>

          {/* Description */}
          <p
            className="text-white text-sm md:text-base mb-8 text-center opacity-90"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            THE VILLAIN STOLE ALL COLORS
            <br />
            FROM THE WORLD
            <br />
            <span className="text-cyan-400">COLLECT THE COLOR CRYSTALS</span>
            <br />
            TO RESTORE THE WORLD'S VIBRANT COLORS
          </p>

          {/* Three color crystals */}
          <div className="flex justify-center items-center gap-8 md:gap-12 mb-8">
            <ColorCrystal3D color="#FF6B6B" size={80} />
            <ColorCrystal3D color="#4ECDC4" size={80} />
            <ColorCrystal3D color="#52BE80" size={80} />
          </div>

          {/* Continue button */}
          <div className="flex justify-center">
            <button
              onClick={onContinue}
              className="pixel-button-glass text-lg"
            >
              CONTINUE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

