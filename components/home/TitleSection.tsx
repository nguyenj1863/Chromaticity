"use client";

import PixelTitle from "./PixelTitle";

interface TitleSectionProps {
  title: string;
  colors: string[];
}

export default function TitleSection({ title, colors }: TitleSectionProps) {
  return (
    <div className="mt-24 mb-8">
      <div className="flex justify-center">
        <div className="pixel-title-responsive">
          <PixelTitle
            text={title}
            colors={colors}
            pixelSize={10}
            letterSpacing={6}
          />
        </div>
      </div>
      {/* Story subtitle */}
      <p className="text-grey-text text-center mt-12 text-base md:text-lg px-4 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: "'Press Start 2P', monospace" }}>
        THE VILLAIN STOLE ALL COLORS FROM THE WORLD
        <br />
        RESTORE THE COLORS AND BRING LIFE BACK
      </p>
    </div>
  );
}

