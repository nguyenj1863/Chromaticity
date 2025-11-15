"use client";

import { useState } from "react";
import BMISettingsModal from "@/components/modals/BMISettingsModal";

export default function SettingsButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="absolute bottom-8 left-8">
        <button className="pixel-button-icon-modern group" onClick={handleClick}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pixel-stroke gear-icon"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
          </svg>
        </button>
      </div>
      <BMISettingsModal isOpen={isModalOpen} onClose={handleClose} />
    </>
  );
}

