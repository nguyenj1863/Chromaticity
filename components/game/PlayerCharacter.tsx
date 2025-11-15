"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { IMUData } from "@/lib/types";
import { ShakeDetector } from "@/lib/shakeDetection";
import { PhysicsEngine, CollisionObject } from "@/lib/physics";

interface PlayerCharacterProps {
  poseState: "standing" | "jumping" | "unknown";
  imuData?: IMUData | null;
  onPositionChange?: (z: number) => void;
}

export default function PlayerCharacter({ poseState, imuData, onPositionChange }: PlayerCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const jumpAnimationRef = useRef<number>(0);
  const isJumpingRef = useRef<boolean>(false);
  
  // Movement velocity (for smooth movement)
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  
  // Shake detector for controller movement
  const shakeDetectorRef = useMemo(() => new ShakeDetector(), []);
  
  // Physics engine
  const physicsEngineRef = useMemo(() => new PhysicsEngine(), []);
  
  // Character collision bounds (approximate size of character)
  // Head: y=1.2 relative to group, size=0.4, so top at y=1.4
  // Legs: y=0 relative to group, size=0.8, so bottom at y=-0.4
  // Total height: 1.8 units (from -0.4 to 1.4 relative to group)
  // Character center relative to group: y=0.5 (middle of 1.8 unit height, at -0.4 + 0.9 = 0.5)
  // Width: ~0.6 (body width 0.5 + arms), depth: ~0.6
  const characterSize = useMemo(() => new THREE.Vector3(0.6, 1.8, 0.6), []); // Width, Height, Depth
  const characterCenterOffset = useMemo(() => new THREE.Vector3(0, 0.5, 0), []); // Offset from group position to character center
  
  // Initialize collision objects
  useEffect(() => {
    // Platform collision (width=4, length=100, height=0.2, at y=0)
    const platformCollision: CollisionObject = {
      aabb: {
        min: new THREE.Vector3(-2, 0, -50), // Platform extends from -50 to +50 in Z
        max: new THREE.Vector3(2, 0.2, 50),
      },
      type: "platform",
    };
    
    physicsEngineRef.addCollisionObject(platformCollision);
    
    // Cave walls (if needed - currently decorative, but can add collision if character moves sideways)
    // Left wall
    const leftWallCollision: CollisionObject = {
      aabb: {
        min: new THREE.Vector3(-25, -10, -50),
        max: new THREE.Vector3(-2.5, 20, 50),
      },
      type: "wall",
    };
    
    // Right wall
    const rightWallCollision: CollisionObject = {
      aabb: {
        min: new THREE.Vector3(2.5, -10, -50),
        max: new THREE.Vector3(25, 20, 50),
      },
      type: "wall",
    };
    
    physicsEngineRef.addCollisionObject(leftWallCollision);
    physicsEngineRef.addCollisionObject(rightWallCollision);
    
    // Cave ceiling (if character jumps too high)
    const ceilingCollision: CollisionObject = {
      aabb: {
        min: new THREE.Vector3(-25, 12, -50),
        max: new THREE.Vector3(25, 20, 50),
      },
      type: "obstacle",
    };
    
    physicsEngineRef.addCollisionObject(ceilingCollision);
    
    return () => {
      physicsEngineRef.clearCollisionObjects();
    };
  }, [physicsEngineRef]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Calculate desired position based on movement and jumping
    let desiredPosition = groupRef.current.position.clone();

    // Handle jumping animation
    if (poseState === "jumping" && !isJumpingRef.current) {
      // Start jump
      isJumpingRef.current = true;
      jumpAnimationRef.current = 0;
    } else if (poseState === "standing" && isJumpingRef.current) {
      // Land from jump - smoothly return to platform
      const baseY = 0.6; // Character's base position (legs bottom at platform top)
      if (desiredPosition.y > baseY + 0.01) {
        desiredPosition.y = Math.max(baseY, desiredPosition.y - delta * 3);
      } else {
        isJumpingRef.current = false;
        jumpAnimationRef.current = 0;
        desiredPosition.y = baseY;
      }
    }

    // Animate jump with smooth arc
    if (isJumpingRef.current && poseState === "jumping") {
      jumpAnimationRef.current += delta * 4; // Jump speed
      // Use a parabolic arc for realistic jump
      const progress = Math.min(jumpAnimationRef.current, Math.PI); // Half cycle (up then down)
      const jumpHeight = Math.sin(progress) * 0.8; // Jump height
      const baseY = 0.6; // Base position (legs bottom at platform top: 0.6 - 0.4 = 0.2)
      desiredPosition.y = baseY + jumpHeight; // Base position + jump height
    } else if (!isJumpingRef.current) {
      // Ensure character is on platform when standing
      // Legs bottom at platform top: group.y - 0.4 = 0.2, so group.y = 0.6
      desiredPosition.y = 0.6;
    }

    // Handle IMU-based movement with shake detection
    if (imuData) {
      // Detect if controller is being shaken
      const isShaking = shakeDetectorRef.detectShake(imuData);
      
      // Constant forward speed (units per second)
      const CONSTANT_SPEED = 5.0; // Adjust this value to change movement speed
      
      // Only allow forward movement when shaking is detected
      // Character can only move forward or stay still
      if (isShaking) {
        // Use constant speed instead of variable acceleration-based speed
        const targetVelocity = CONSTANT_SPEED;
        
        // Smoothly transition to target velocity
        const smoothing = 0.9;
        velocityRef.current.z = velocityRef.current.z * smoothing + targetVelocity * (1 - smoothing);
        
        // Update desired position (only forward, no sideways movement)
        // Negative Z to move in opposite direction
        desiredPosition.z -= velocityRef.current.z * delta;
      } else {
        // Not shaking - gradually slow down to stop
        const deceleration = 0.85; // Deceleration factor
        velocityRef.current.z *= deceleration;
        
        // Stop if velocity is very small
        if (Math.abs(velocityRef.current.z) < 0.05) {
          velocityRef.current.z = 0;
        }
        
        // Apply remaining velocity (negative Z to move in opposite direction)
        desiredPosition.z -= velocityRef.current.z * delta;
      }
      
      // Keep character within platform bounds (platform width is 4, so ±2)
      // Center the character on the platform
      desiredPosition.x = 0; // Always centered, no sideways movement
    }
    
    // Apply physics: ALWAYS check collisions to prevent intersections
    // Note: desiredPosition is the group position, but character center is offset upward
    // We need to check collision at the character's actual center
    const characterCenter = desiredPosition.clone().add(characterCenterOffset);
    const resolvedCenter = physicsEngineRef.checkAndResolveCollision(
      characterCenter,
      characterSize,
      characterCenterOffset
    );
    // Convert back to group position
    let resolvedPosition = resolvedCenter.clone().sub(characterCenterOffset);
    
    // Ensure character doesn't intersect with platform
    // Character's collision box bottom is at: group.y + characterCenterOffset.y - characterSize.y/2
    // = group.y + 0.5 - 0.9 = group.y - 0.4
    // Platform top is at y=0.2
    // We need: group.y - 0.4 >= 0.2, so group.y >= 0.6
    const characterBottom = resolvedPosition.y + characterCenterOffset.y - characterSize.y / 2;
    const platformTop = 0.2;
    
    if (characterBottom < platformTop) {
      // Character is intersecting platform - push it up
      // Calculate required group.y so character bottom is at platform top
      resolvedPosition.y = platformTop - characterCenterOffset.y + characterSize.y / 2;
    }
    
    // Ensure character stays on top of platform when standing
    if (!isJumpingRef.current && poseState === "standing") {
      // Character should be exactly on platform (legs bottom at platform top)
      // Legs bottom is at group.y - 0.4, platform top is 0.2
      // So: group.y - 0.4 = 0.2, group.y = 0.6
      resolvedPosition.y = platformTop + 0.4; // 0.2 + 0.4 = 0.6
    }
    
    // Apply resolved position
    groupRef.current.position.copy(resolvedPosition);
    
    // Notify parent of position change for camera following
    if (onPositionChange) {
      onPositionChange(groupRef.current.position.z);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.6, 0]} rotation={[0, Math.PI, 0]}>
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
  );
}

