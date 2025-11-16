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
  fireToken?: number;
  collectedCrystals: number[];
  shotTargets: number[];
  onTargetShot?: (targetId: number) => void;
  onCrystalCollected?: (payload: { id: number; name: string; color: string }) => void;
  onLevelReady?: () => void;
  levelData?: LevelData | null;
  onLevelDataChange?: (data: LevelData) => void;
  onPlayerDeath?: () => void;
  forceJump?: boolean;
}

// Component to set camera to look at character from the side and follow it
function CameraController({
  characterZ,
  characterY,
  focusTarget,
  focusMode,
  characterPosition,
  focusYaw,
  aimPitch,
}: {
  characterZ: number;
  characterY: number;
  focusTarget?: THREE.Vector3 | null;
  focusMode: boolean;
  characterPosition?: THREE.Vector3 | null;
  focusYaw?: number | null;
  aimPitch?: number | null;
}) {
  const { camera } = useThree();
  
  useEffect(() => {
    if (focusMode && characterPosition) {
      const headOffset = new THREE.Vector3(0, 1.1, 0);
      const camPos = characterPosition.clone().add(headOffset);
      camera.position.copy(camPos);
      let yawDeg = focusYaw;
      if (yawDeg == null && focusTarget) {
        const dir = focusTarget.clone().sub(camPos);
        yawDeg = (THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z)) + 360) % 360;
      }
      const yawRad = THREE.MathUtils.degToRad(yawDeg ?? 0);
      const pitchRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(aimPitch ?? 0, -60, 60));
      const forward = new THREE.Vector3(
        Math.sin(yawRad) * Math.cos(pitchRad),
        Math.sin(pitchRad),
        -Math.cos(yawRad) * Math.cos(pitchRad)
      );
      const lookTarget = camPos.clone().add(forward);
      camera.up.set(0, 1, 0);
      camera.lookAt(lookTarget);
    } else {
      const targetPos = focusTarget ?? new THREE.Vector3(0, characterY + 0.35, characterZ);
      const camPos = focusTarget
        ? new THREE.Vector3(targetPos.x + 4, targetPos.y + 0.5, targetPos.z)
        : new THREE.Vector3(6, characterY + 0.35, characterZ);
      camera.position.copy(camPos);
      camera.lookAt(targetPos);
    }
    camera.updateProjectionMatrix();
  }, [camera, characterZ, characterY, focusTarget, focusMode, characterPosition, focusYaw, aimPitch]);

  return null;
}

export default function GameScene({
  poseState,
  imuData,
  fireToken = 0,
  collectedCrystals,
  shotTargets,
  onTargetShot,
  onCrystalCollected,
  onLevelReady,
  levelData: controlledLevelData,
  onLevelDataChange,
  onPlayerDeath,
  forceJump = false,
}: GameSceneProps) {
  const [characterZ, setCharacterZ] = useState(0);
  const [characterY, setCharacterY] = useState(0.6);
  const [characterPosition, setCharacterPosition] = useState<THREE.Vector3 | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [levelData, setLevelData] = useState<LevelData | null>(controlledLevelData ?? null);
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
  const [aimPitch, setAimPitch] = useState<number | null>(null);
  const focusYaw = useMemo(() => {
    if (!activeFocusTarget || !characterPosition) return null;
    const targetPos = levelToWorld(activeFocusTarget.x, activeFocusTarget.y, activeFocusTarget.z);
    const dirX = targetPos.x - characterPosition.x;
    const dirZ = targetPos.z - characterPosition.z;
    return (THREE.MathUtils.radToDeg(Math.atan2(dirX, -dirZ)) + 360) % 360;
  }, [activeFocusTarget, characterPosition, levelToWorld]);

  const aimAlignment = useMemo(() => {
    if (!activeFocusTarget || !characterPosition) return null;
    const targetPos = levelToWorld(activeFocusTarget.x, activeFocusTarget.y, activeFocusTarget.z);
    const headPos = characterPosition.clone().add(new THREE.Vector3(0, 1.1, 0));
    const dir = targetPos.clone().sub(headPos);
    const horizontal = Math.hypot(dir.x, dir.z) || 0.0001;
    const targetPitch = THREE.MathUtils.radToDeg(Math.atan2(dir.y, horizontal));
    if (aimPitch == null) {
      return { diff: Math.abs(targetPitch), signedDiff: targetPitch, targetPitch };
    }
    const signedDiff = targetPitch - aimPitch;
    return { diff: Math.abs(signedDiff), signedDiff, targetPitch };
  }, [activeFocusTarget, characterPosition, aimPitch, levelToWorld]);

  useEffect(() => {
    if (controlledLevelData) {
      setLevelData(controlledLevelData);
    }
  }, [controlledLevelData]);

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
    onPlayerDeath?.();
  }, [levelData, checkpoints, currentCheckpointId, levelToWorld, onPlayerDeath]);

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
      const clamped = THREE.MathUtils.clamp(imuData.aiming_angle_deg, -75, 75);
      setAimPitch((prev) => {
        if (prev == null) return clamped;
        return THREE.MathUtils.lerp(prev, clamped, 0.25);
      });
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
          <CameraController
            characterZ={characterZ}
            characterY={characterY}
            focusTarget={focusTargetWorld}
            focusMode={!!activeFocusTarget}
            characterPosition={characterPosition}
            focusYaw={focusYaw}
            aimPitch={aimPitch}
          />
        )}
        
        {/* Lighting - cave lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[0, 5, 5]} intensity={1.2} />
        <pointLight position={[0, 3, 0]} intensity={0.8} color="#ffffff" />
        <pointLight position={[0, 1.5, 2]} intensity={0.5} color="#ffffff" />

        {/* Scene */}
        <GameLevel
          onLevelReady={onLevelReady}
          onLevelDataChange={(data) => {
            setLevelData(data);
            onLevelDataChange?.(data);
          }}
          collectedCrystals={collectedCrystals}
          shotTargets={shotTargets}
        />
        {!devMode && (
          <PlayerCharacter
            poseState={poseState}
            imuData={imuData}
            disableMovement={!!activeFocusTarget}
            focusMode={!!activeFocusTarget}
            aimPitch={aimAlignment?.targetPitch ?? aimPitch}
            focusYaw={focusYaw}
            onPositionChange={handlePositionChange}
            collectedCrystals={collectedCrystals}
            onCrystalCollected={handleCrystalPickup}
            onCheckpointReached={handleCheckpointReached}
            onDeath={handleDeath}
            respawnRequest={respawnRequest}
            onRespawnHandled={handleRespawnHandled}
            levelData={levelData}
            forceJump={forceJump}
          />
        )}
      </Canvas>

      {activeFocusTarget && (
        <>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-white z-40 pointer-events-none"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            <div className="bg-black bg-opacity-70 px-6 py-4 rounded border border-white text-center space-y-2">
              <p className="text-sm">FOCUS MODE</p>
              <p className="text-xs opacity-80">First-person aim active</p>
              <p className="text-[10px] opacity-60">Align the bullseye and press fire</p>
              {aimAlignment && (
                <p className="text-[10px] opacity-80">
                  Offset: {aimAlignment.diff.toFixed(1)}°
                </p>
              )}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-40">
            <div
              className="relative w-32 h-32"
              style={{
                transform: `translate(0px, ${aimAlignment ? THREE.MathUtils.clamp(-aimAlignment.signedDiff!, -25, 25) : 0}px)`,
              }}
            >
              <div className="absolute inset-0 rounded-full border-2 border-white/80" />
              <div className="absolute inset-[30%] rounded-full border border-white/60" />
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/70" />
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/70" />
              <div className="absolute inset-[45%] rounded-full bg-red-500 shadow-[0_0_8px_rgba(255,0,0,0.8)]" />
            </div>
          </div>
        </>
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

