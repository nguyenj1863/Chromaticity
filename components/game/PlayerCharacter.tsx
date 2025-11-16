"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { IMUData } from "@/lib/types";
import { ShakeDetector } from "@/lib/shakeDetection";
import { LevelData } from "@/lib/levelGenerator";
import CollidableObjects from "./CollidableObjects";
import { 
  resolveCollisions, 
  GRAVITY, 
  JUMP_SPEED,
  CollidableObject 
} from "@/lib/collisionSystem";

interface PlayerCharacterProps {
  poseState: "standing" | "jumping" | "unknown";
  imuData?: IMUData | null;
  forceMove?: boolean;
  forceJump?: boolean;
  disableMovement?: boolean;
  onPositionChange?: (position: THREE.Vector3) => void;
  collectedCrystals?: number[];
  onCrystalCollected?: (id: number) => void;
  onCheckpointReached?: (checkpointId: number) => void;
  onDeath?: () => void;
  respawnRequest?: { position: THREE.Vector3; token: number } | null;
  onRespawnHandled?: () => void;
  levelData?: LevelData | null;
}

export default function PlayerCharacter({
  poseState,
  imuData,
  forceMove = false,
  forceJump = false,
  disableMovement = false,
  onPositionChange,
  collectedCrystals = [],
  onCrystalCollected,
  onCheckpointReached,
  onDeath,
  respawnRequest,
  onRespawnHandled,
  levelData
}: PlayerCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Movement and physics state
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef<boolean>(false);
  const previousPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 10, 0)); // Start in the sky
  const hasInitializedRef = useRef<boolean>(false);
  
  // Shake detector for controller movement
  const shakeDetectorRef = useMemo(() => new ShakeDetector(), []);
  
  // Collidable objects from level
  const [collidables, setCollidables] = useState<CollidableObject[]>([]);
  
  // Character collision bounds
  // Character center relative to group: y=0.5 (middle of 1.8 unit height)
  // Width: ~0.6 (body width 0.5 + arms), depth: ~0.6, height: 1.8
  const characterSize = useMemo(() => new THREE.Vector3(0.6, 1.8, 0.6), []); // Width, Height, Depth
  const characterCenterOffset = useMemo(() => new THREE.Vector3(0, 0.5, 0), []); // Offset from group position to character center
  const respawnTokenRef = useRef<number | null>(null);
  const lastCheckpointRef = useRef<number | null>(null);
  const lastDeathTimeRef = useRef<number>(0);
  const collectedCrystalsRef = useRef<number[]>(collectedCrystals);
  const levelToWorld = useCallback((x: number, y: number, z: number) => {
    return new THREE.Vector3(-x, y, -z);
  }, []);

  useEffect(() => {
    collectedCrystalsRef.current = collectedCrystals;
  }, [collectedCrystals]);

  useEffect(() => {
    if (!respawnRequest || !groupRef.current) return;
    if (respawnRequest.token === respawnTokenRef.current) return;
    respawnTokenRef.current = respawnRequest.token;
    groupRef.current.position.copy(respawnRequest.position);
    velocityRef.current.set(0, 0, 0);
    isGroundedRef.current = false;
    previousPositionRef.current.copy(respawnRequest.position);
    onRespawnHandled?.();
  }, [respawnRequest, onRespawnHandled]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Initialize position if first frame
    if (!hasInitializedRef.current) {
      groupRef.current.position.set(0, 10, 0); // Start in the sky
      hasInitializedRef.current = true;
    }
    
    if (collidables.length === 0) return;

    if (disableMovement) {
      velocityRef.current.set(0, 0, 0);
      return;
    }

    // ===== ORDER OF OPERATIONS =====
    // 1. Read inputs (move forward, jump state from camera / controller)
    const currentPosition = groupRef.current.position.clone();
    let desiredPosition = currentPosition.clone();
    let velocity = velocityRef.current.clone();
    
    // Handle jump input (only if grounded - no double jumping)
    if ((poseState === "jumping" || forceJump) && isGroundedRef.current && velocity.y <= 0.1) {
      // Start jump - apply upward velocity
      velocity.y = JUMP_SPEED;
      isGroundedRef.current = false;
    }
    
    // 2. Update velocities based on input and gravity
    // Apply gravity when not grounded
    // Also check if player should be falling (not on a platform)
    if (!isGroundedRef.current) {
      velocity.y += GRAVITY * delta;
    } else {
      // If grounded, ensure vertical velocity is zero or negative (not jumping up)
      if (velocity.y > 0.1) {
        // Player is jumping, allow it
      } else {
        // Player is on ground, keep vertical velocity at 0
        velocity.y = 0;
      }
    }
    
    // Handle IMU-based horizontal movement with walking speed fallback to shake
    if (imuData || forceMove) {
      const walkingSpeed = imuData?.walking_speed;
      const walkProvided = typeof walkingSpeed === "number";
      const targetSpeed = walkProvided
        ? -THREE.MathUtils.clamp(walkingSpeed ?? 0, 0, 1) * 5
        : forceMove
        ? -3
        : 0;

      if (walkProvided || forceMove) {
        const smoothing = 0.9;
        velocity.z = velocity.z * smoothing + targetSpeed * (1 - smoothing);
      } else if (imuData) {
        const isShaking = shakeDetectorRef.detectShake(imuData);
        const CONSTANT_SPEED = -2.5;
        if (isShaking) {
          const smoothing = 0.9;
          velocity.z = velocity.z * smoothing + CONSTANT_SPEED * (1 - smoothing);
        } else {
          const deceleration = 0.85;
          velocity.z *= deceleration;
          if (Math.abs(velocity.z) < 0.05) {
            velocity.z = 0;
          }
        }
      } else {
        const deceleration = 0.85;
        velocity.z *= deceleration;
        if (Math.abs(velocity.z) < 0.05) velocity.z = 0;
      }

      velocity.x = 0;
    }
    
    // 3. Update tentative position based on velocity
    desiredPosition.addScaledVector(velocity, delta);
    
    // 4. Rebuild playerBox and check collisions with all obstacles
    // 5. Resolve collisions and update isGrounded, velocityY, and player.position
    const collisionResult = resolveCollisions(
      desiredPosition,
      velocity,
      characterSize,
      characterCenterOffset,
      collidables
    );
    
    // Update grounded state
    isGroundedRef.current = collisionResult.isGrounded;
    
    // Update velocity (Y may have been changed by collision resolution)
    velocityRef.current.copy(collisionResult.velocity);
    
    // 6. Update camera / animations after collision resolution
    groupRef.current.position.copy(collisionResult.position);
    previousPositionRef.current.copy(collisionResult.position);

    const updatedPosition = groupRef.current.position.clone();

    // Check for hazards (falling or pits)
    const now = performance.now();
    let diedThisFrame = false;
    if (updatedPosition.y < -5) {
      diedThisFrame = true;
    } else if (levelData?.obstacles) {
      diedThisFrame = levelData.obstacles.some((obstacle) => {
        if (obstacle.type !== "pit") return false;
        const pitCenter = levelToWorld(obstacle.x, obstacle.y, obstacle.z);
        const withinX = Math.abs(updatedPosition.x - pitCenter.x) <= obstacle.width / 2;
        const withinZ = Math.abs(updatedPosition.z - pitCenter.z) <= obstacle.height / 2;
        return withinX && withinZ && updatedPosition.y <= 1.0;
      });
    }

    if (diedThisFrame) {
      if (onDeath && now - lastDeathTimeRef.current > 500) {
        lastDeathTimeRef.current = now;
        onDeath();
      }
      return;
    }

    // Checkpoints
    if (levelData?.checkpoints && onCheckpointReached) {
      levelData.checkpoints.forEach((checkpoint) => {
        const checkpointPos = levelToWorld(checkpoint.x, checkpoint.y, checkpoint.z);
        const withinX = Math.abs(updatedPosition.x - checkpointPos.x) <= checkpoint.width / 2;
        const withinZ = Math.abs(updatedPosition.z - checkpointPos.z) <= checkpoint.depth / 2;
        if (withinX && withinZ && updatedPosition.y <= checkpointPos.y + 0.6) {
          if (lastCheckpointRef.current !== checkpoint.id) {
            lastCheckpointRef.current = checkpoint.id;
            onCheckpointReached(checkpoint.id);
          }
        }
      });
    }

    // Crystal collection
    if (levelData?.crystals && onCrystalCollected) {
      levelData.crystals.forEach((crystal) => {
        if (collectedCrystalsRef.current.includes(crystal.id)) return;
        if (crystal.state === "hidden" && crystal.requiresTarget) return;

        const crystalPosition = levelToWorld(crystal.x, crystal.y, crystal.z);
        const distance = crystalPosition.distanceTo(updatedPosition.clone().add(characterCenterOffset));
        if (distance <= 0.8) {
          collectedCrystalsRef.current = [...collectedCrystalsRef.current, crystal.id];
          onCrystalCollected(crystal.id);
        }
      });
    }
    
    // Notify parent of position change for camera following
    onPositionChange?.(updatedPosition);
  });

  return (
    <>
      {/* Register collidable objects from level */}
      {levelData && (
        <CollidableObjects 
          levelData={levelData} 
          onCollidablesReady={setCollidables}
        />
      )}
      
      <group ref={groupRef} position={[0, 0.6, 0]} rotation={[0, 0, 0]}>
      {/* Head - pixelated blocky style (grey/white - no color) */}
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#CCCCCC" flatShading roughness={0.8} />
      </mesh>

      {/* Body/Torso (darker grey) */}
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.5, 0.7, 0.4]} />
        <meshStandardMaterial color="#888888" flatShading roughness={0.8} />
      </mesh>

      {/* Left Arm (medium grey) */}
      <mesh position={[-0.4, 0.7, 0]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color="#AAAAAA" flatShading roughness={0.8} />
      </mesh>

      {/* Right Arm (medium grey) */}
      <mesh position={[0.4, 0.7, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color="#AAAAAA" flatShading roughness={0.8} />
      </mesh>

      {/* Left Leg (dark grey) - bottom of leg at y = 0 relative to group */}
      <mesh position={[-0.15, 0, 0]}>
        <boxGeometry args={[0.25, 0.8, 0.25]} />
        <meshStandardMaterial color="#666666" flatShading roughness={0.8} />
      </mesh>

      {/* Right Leg (dark grey) - bottom of leg at y = 0 relative to group */}
      <mesh position={[0.15, 0, 0]}>
        <boxGeometry args={[0.25, 0.8, 0.25]} />
        <meshStandardMaterial color="#666666" flatShading roughness={0.8} />
      </mesh>
    </group>
    </>
  );
}


