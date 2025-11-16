"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import GameLevel from "./GameLevel";
import PlayerCharacter from "./PlayerCharacter";
import DevCameraController from "./DevCameraController";
import * as THREE from "three";

import { IMUData } from "@/lib/types";
import { LevelData } from "@/lib/levelGenerator";

interface GameSceneProps {
  poseState: "standing" | "jumping" | "unknown";
  imuData?: IMUData | null;
  forceMove?: boolean;
  forceJump?: boolean;
  fireToken?: number;
  collectedCrystals: number[];
  shotTargets: number[];
  onTargetShot?: (targetId: number) => void;
  onCrystalCollected?: (payload: { id: number; name: string; color: string }) => void;
  onLevelReady?: () => void;
}

// Component to set camera to look at character from the side and follow it
function CameraController({ characterZ, characterY, focusTarget }: { characterZ: number; characterY: number; focusTarget?: THREE.Vector3 | null }) {
  const { camera } = useThree();
  
  useEffect(() => {
    const targetPos = focusTarget ?? new THREE.Vector3(0, characterY + 0.35, characterZ);
    const camPos = focusTarget
      ? new THREE.Vector3(targetPos.x + 4, targetPos.y + 0.5, targetPos.z)
      : new THREE.Vector3(6, characterY + 0.35, characterZ);
    camera.position.copy(camPos);
    camera.lookAt(targetPos);
    camera.updateProjectionMatrix();
  }, [camera, characterZ, characterY, focusTarget]);

  return null;
}

export default function GameScene({
  poseState,
  imuData,
  forceMove = false,
  forceJump = false,
  fireToken = 0,
  collectedCrystals,
  shotTargets,
  onTargetShot,
  onCrystalCollected,
  onLevelReady
}: GameSceneProps) {
  const [characterZ, setCharacterZ] = useState(0);
  const [characterY, setCharacterY] = useState(0.6);
  const [characterPosition, setCharacterPosition] = useState<THREE.Vector3 | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [currentCheckpointId, setCurrentCheckpointId] = useState<number | null>(null);
  const [respawnRequest, setRespawnRequest] = useState<{ position: THREE.Vector3; token: number } | null>(null);
  const [activeFocusTarget, setActiveFocusTarget] = useState<LevelData["targets"][number] | null>(null);
  const [targetHitMessage, setTargetHitMessage] = useState<string | null>(null);
  const levelToWorld = useCallback((x: number, y: number, z: number) => new THREE.Vector3(-x, y, -z), []);

  const checkpoints = useMemo(() => levelData?.checkpoints ?? [], [levelData]);
  const focusTargetWorld = useMemo(() => {
    if (!activeFocusTarget) return null;
    return levelToWorld(activeFocusTarget.x, activeFocusTarget.y, activeFocusTarget.z);
  }, [activeFocusTarget, levelToWorld]);
  const [aimingAngle, setAimingAngle] = useState<number | null>(null);
  const aimAlignment = useMemo(() => {
    if (!activeFocusTarget || !characterPosition || aimingAngle == null) return null;
    const targetPos = levelToWorld(activeFocusTarget.x, activeFocusTarget.y, activeFocusTarget.z);
    const dirX = targetPos.x - characterPosition.x;
    const dirZ = targetPos.z - characterPosition.z;
    const targetAngle = (THREE.MathUtils.radToDeg(Math.atan2(dirX, -dirZ)) + 360) % 360;
    let diff = Math.abs(targetAngle - aimingAngle);
    if (diff > 180) diff = 360 - diff;
    return { diff, targetAngle };
  }, [activeFocusTarget, characterPosition, aimingAngle, levelToWorld]);

  useEffect(() => {
    if (checkpoints.length > 0 && currentCheckpointId === null) {
      setCurrentCheckpointId(checkpoints[0].id);
    }
  }, [checkpoints, currentCheckpointId]);

  const handlePositionChange = useCallback((position: THREE.Vector3) => {
    setCharacterZ(position.z);
    setCharacterY(position.y);
    setCharacterPosition(position.clone());
  }, []);

  const handleCheckpointReached = useCallback((checkpointId: number) => {
    setCurrentCheckpointId((prev) => (prev === checkpointId ? prev : checkpointId));
  }, []);

  const handleDeath = useCallback(() => {
    if (!levelData || checkpoints.length === 0) return;
    const fallbackId = currentCheckpointId ?? checkpoints[0].id;
    const checkpoint = checkpoints.find((cp) => cp.id === fallbackId) ?? checkpoints[0];
    const respawnPos = levelToWorld(checkpoint.x, checkpoint.y + 0.6, checkpoint.z);
    setRespawnRequest({ position: respawnPos, token: performance.now() });
  }, [levelData, checkpoints, currentCheckpointId, levelToWorld]);

  const handleRespawnHandled = useCallback(() => {
    setRespawnRequest(null);
  }, []);

  const handleCrystalPickup = useCallback((id: number) => {
    if (!levelData || collectedCrystals.includes(id)) return;
    const crystal = levelData.crystals.find((c) => c.id === id);
    if (!crystal) return;
    const name = `${crystal.color.charAt(0).toUpperCase()}${crystal.color.slice(1)} Crystal`;
    onCrystalCollected?.({ id, name, color: crystal.color });
  }, [levelData, collectedCrystals, onCrystalCollected]);

  useEffect(() => {
    if (!levelData || !characterPosition || activeFocusTarget) return;
    const focusableTargets = levelData.targets.filter(
      (target) =>
        target.cameraFocus &&
        !shotTargets.includes(target.id) &&
        !target.shot
    );
    focusableTargets.some((target) => {
      const worldPos = levelToWorld(target.x, target.y, target.z);
      if (worldPos.distanceTo(characterPosition) <= 3.5) {
        setActiveFocusTarget(target);
        return true;
      }
      return false;
    });
  }, [levelData, characterPosition, activeFocusTarget, shotTargets, levelToWorld]);

  useEffect(() => {
    if (!activeFocusTarget) return;
    if (shotTargets.includes(activeFocusTarget.id)) {
      setActiveFocusTarget(null);
    }
  }, [shotTargets, activeFocusTarget]);

  useEffect(() => {
    if (!activeFocusTarget || !characterPosition) return;
    const worldPos = levelToWorld(activeFocusTarget.x, activeFocusTarget.y, activeFocusTarget.z);
    if (worldPos.distanceTo(characterPosition) > 5) {
      setActiveFocusTarget(null);
    }
  }, [activeFocusTarget, characterPosition, levelToWorld]);

  const lastFireTokenRef = useRef<number>(0);

  useEffect(() => {
    if (!activeFocusTarget || !aimAlignment) return;
    if (!fireToken || fireToken === lastFireTokenRef.current) return;
    lastFireTokenRef.current = fireToken;
    if (aimAlignment.diff <= 12) {
      onTargetShot?.(activeFocusTarget.id);
      setTargetHitMessage("Target Destroyed!");
      setActiveFocusTarget(null);
      setTimeout(() => setTargetHitMessage(null), 2000);
    } else {
      setTargetHitMessage("Adjust Aim");
      setTimeout(() => setTargetHitMessage(null), 1500);
    }
  }, [fireToken, activeFocusTarget, onTargetShot, aimAlignment]);

  useEffect(() => {
    if (imuData?.aiming_angle_deg != null) {
      setAimingAngle((imuData.aiming_angle_deg % 360 + 360) % 360);
    }
  }, [imuData]);

  // Toggle dev mode with 'M' key
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'm' && event.ctrlKey) {
        setDevMode(prev => !prev);
        setActiveFocusTarget(null);
        setTargetHitMessage(null);
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
          <CameraController characterZ={characterZ} characterY={characterY} focusTarget={focusTargetWorld} />
        )}
        
        {/* Lighting - cave lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[0, 5, 5]} intensity={1.2} />
        <pointLight position={[0, 3, 0]} intensity={0.8} color="#ffffff" />
        <pointLight position={[0, 1.5, 2]} intensity={0.5} color="#ffffff" />

        {/* Scene */}
        <GameLevel
          onLevelReady={onLevelReady}
          onLevelDataChange={setLevelData}
          collectedCrystals={collectedCrystals}
          shotTargets={shotTargets}
        />
        {!devMode && (
          <PlayerCharacter
            poseState={poseState}
            imuData={imuData}
            forceMove={forceMove}
            forceJump={forceJump}
            disableMovement={!!activeFocusTarget}
            onPositionChange={handlePositionChange}
            collectedCrystals={collectedCrystals}
            onCrystalCollected={handleCrystalPickup}
            onCheckpointReached={handleCheckpointReached}
            onDeath={handleDeath}
            respawnRequest={respawnRequest}
            onRespawnHandled={handleRespawnHandled}
            levelData={levelData}
          />
        )}
      </Canvas>

      {activeFocusTarget && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-white z-40 pointer-events-none"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          <div className="bg-black bg-opacity-70 px-6 py-4 rounded border border-white text-center space-y-2">
            <p className="text-sm">FOCUS MODE</p>
            <p className="text-xs opacity-80">Aim your controller toward the target</p>
            <p className="text-[10px] opacity-60">Press the fire button on the controller</p>
            {aimAlignment && (
              <p className="text-[10px] opacity-80">
                Aim offset: {aimAlignment.diff.toFixed(1)}°
              </p>
            )}
          </div>
        </div>
      )}

      {targetHitMessage && (
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-4 py-2 rounded z-40"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          {targetHitMessage}
        </div>
      )}

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
            Ctrl+M: Toggle Dev Mode
          </div>
        </div>
      )}
    </>
  );
}

