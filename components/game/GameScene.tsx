"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import GameLevel from "./GameLevel";
import PlayerCharacter from "./PlayerCharacter";
import DevCameraController from "./DevCameraController";
import * as THREE from "three";

import { IMUData } from "@/lib/types";

interface GameSceneProps {
  poseState: "standing" | "jumping" | "unknown";
  imuData?: IMUData | null;
  onLevelReady?: () => void;
}

// Component to set camera to look at character from the side and follow it
function CameraController({ characterZ }: { characterZ: number }) {
  const { camera } = useThree();
  
  useEffect(() => {
    // Position camera to the right side, following character's Z position
    camera.position.set(6, 1.5, characterZ);
    // Make camera look at the character (at character's Z position, slightly elevated)
    camera.lookAt(0, 1, characterZ);
    camera.updateProjectionMatrix();
  }, [camera, characterZ]);

  return null;
}

export default function GameScene({ poseState, imuData, onLevelReady }: GameSceneProps) {
  const [characterZ, setCharacterZ] = useState(0);
  const [devMode, setDevMode] = useState(false);

  // Toggle dev mode with 'D' key
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'd' && event.ctrlKey) {
        setDevMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <>
      <Canvas
        camera={{ 
          position: [6, 1.5, 0], // Side view - camera to the right, looking at character profile
          fov: 60
        }}
        gl={{ 
          antialias: false, // Pixelated look
          powerPreference: "high-performance"
        }}
        style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
      >
        {devMode ? (
          <DevCameraController enabled={true} />
        ) : (
          <CameraController characterZ={characterZ} />
        )}
        
        {/* Lighting - cave lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[0, 5, 5]} intensity={1.2} />
        <pointLight position={[0, 3, 0]} intensity={0.8} color="#ffffff" />
        <pointLight position={[0, 1.5, 2]} intensity={0.5} color="#ffffff" />

        {/* Scene */}
        <GameLevel onLevelReady={onLevelReady} />
        {!devMode && (
          <PlayerCharacter poseState={poseState} imuData={imuData} onPositionChange={setCharacterZ} />
        )}
      </Canvas>

      {/* Dev Mode UI Overlay */}
      {devMode && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            background: "rgba(0, 0, 0, 0.8)",
            color: "#fff",
            padding: "15px",
            borderRadius: "8px",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px",
            lineHeight: "1.6",
            zIndex: 1000,
            border: "2px solid #fff",
          }}
        >
          <div style={{ marginBottom: "10px", fontSize: "12px", color: "#ff6b6b" }}>
            DEV MODE ACTIVE
          </div>
          <div style={{ marginBottom: "5px" }}>CONTROLS:</div>
          <div>WASD / Arrows: Move</div>
          <div>Q / Space: Move Up</div>
          <div>E / Z: Move Down</div>
          <div>Mouse Drag: Look Around</div>
          <div style={{ marginTop: "10px", color: "#ffd93d" }}>
            Ctrl+D: Toggle Dev Mode
          </div>
        </div>
      )}
    </>
  );
}

