"use client";

import { useMemo } from "react";

interface BackgroundEffectsProps {
  colors: string[];
}

export default function BackgroundEffects({ colors }: BackgroundEffectsProps) {
  // Generate random values once and memoize them to prevent re-rendering issues
  const particles = useMemo(() => {
    return [...Array(30)].map((_, i) => {
      const colorIndex = i % colors.length;
      return {
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 20 + Math.random() * 15,
        color: colors[colorIndex],
      };
    });
  }, [colors]);

  return (
    <>
      {/* Grey pixel background */}
      <div className="absolute inset-0">
        <div className="pixel-grid-grey"></div>
        <div className="grey-overlay"></div>
      </div>

      {/* Color particles - representing colors being restored */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="color-particle"
            style={{
              left: `${particle.left}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              backgroundColor: particle.color,
              boxShadow: `0 0 15px ${particle.color}, 0 0 30px ${particle.color}, 0 0 45px ${particle.color}`,
            }}
          />
        ))}
      </div>
    </>
  );
}

