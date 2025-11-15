"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";

export default function PhaserGame() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: containerRef.current,
      scene: {
        create: function () {
          this.add.text(400, 300, "Phaser Game", {
            fontSize: "48px",
            color: "#ffffff",
          }).setOrigin(0.5);
        },
      },
      backgroundColor: "#2c3e50",
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full border border-gray-300 rounded-lg" />;
}

