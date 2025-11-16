"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LevelGenerator, LevelData } from "@/lib/levelGenerator";
import GameCrystal from "./GameCrystal";

interface GameLevelProps {
  onLevelData?: (data: LevelData) => void;
  onLevelReady?: () => void;
  collectedCrystals?: number[];
  shotTargets?: number[];
}

export default function GameLevel({ onLevelData, onLevelReady, collectedCrystals = [], shotTargets = [] }: GameLevelProps) {
  const movingPlatformsRef = useRef<Map<number, { startX: number; direction: number; time: number }>>(new Map());
  const platformMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());

  // Generate level data using Phaser-based generator
  const levelData = useMemo(() => {
    const generator = new LevelGenerator();
    const data = generator.generateLevel();
    
    // Verify all data is generated
    if (!data.ground || !data.ground.segments || data.ground.segments.length === 0) {
      console.error("Ground data is missing or empty!", data);
    } else {
      console.log(`Generated ${data.ground.segments.length} ground segments with ${data.ground.segments[0]?.dirtLayerHeight || 0} unit deep dirt`);
    }
    
    console.log(`Generated ${data.platforms.length} platforms`);
    console.log(`Generated ${data.obstacles.length} obstacles`);
    console.log(`Generated ${data.crystals.length} crystals`);
    console.log(`Generated ${data.targets.length} targets`);
    console.log(`Boss gate at z=${data.bossGate.z}, required crystals: ${data.bossGate.requiredCrystals}`);
    
    if (onLevelData) {
      onLevelData(data);
    }
    
    // Notify that level data is ready immediately (generation is fast)
    // Then notify again after a short delay to ensure rendering has started
    if (onLevelReady) {
      onLevelReady(); // Immediate callback
      // Also call after delay to ensure rendering is complete
      setTimeout(() => {
        onLevelReady();
      }, 200);
    }
    
    return data;
  }, [onLevelData, onLevelReady]);

  // Update moving platforms
  useFrame((state, delta) => {
    levelData.platforms.forEach((platform, index) => {
      if (platform.type === 'moving' && platform.moveDirection && platform.moveDistance && platform.moveSpeed) {
        if (!movingPlatformsRef.current.has(index)) {
          movingPlatformsRef.current.set(index, {
            startX: platform.x,
            direction: platform.moveDirection === 'left' ? -1 : 1,
            time: 0
          });
        }

        const platformData = movingPlatformsRef.current.get(index);
        const mesh = platformMeshesRef.current.get(index);
        
        if (platformData && mesh) {
          platformData.time += delta * platform.moveSpeed;
          const offset = Math.sin(platformData.time) * platform.moveDistance;
          mesh.position.x = platformData.startX + offset * platformData.direction;
        }
      }
    });
  });

  // Check if crystal should be visible
  const isCrystalVisible = (crystal: typeof levelData.crystals[0]) => {
    if (crystal.state === 'collected') return false;
    if (crystal.state === 'visible') return true;
    if (crystal.state === 'hidden' && crystal.requiresTarget) {
      return shotTargets.includes(crystal.requiresTarget);
    }
    return false;
  };

  // Check if boss gate should be open
  const isBossGateOpen = levelData.bossGate.open || collectedCrystals.length >= levelData.bossGate.requiredCrystals;

  return (
    <group rotation={[0, Math.PI, 0]}>
      {/* Ground - Rock and Dirt Layers with Minerals and Bones */}
      {levelData.ground?.segments?.map((segment, segIndex) => {
        const rockTopY = 0.2; // Top of rock layer (where player walks)
        const rockCenterY = rockTopY - segment.rockLayerHeight / 2; // Center of rock layer (0.2 - 0.15 = 0.05)
        const dirtTopY = rockTopY - segment.rockLayerHeight; // Top of dirt layer (0.2 - 0.3 = -0.1)
        const dirtCenterY = dirtTopY - segment.dirtLayerHeight / 2; // Center of dirt layer (-0.1 - 20 = -20.1)
        
        return (
          <group key={`ground-segment-${segIndex}`} position={[0, 0, segment.z]}>
            {/* Rock Layer (top) - 0.3 units thick at y=0.2 */}
            <mesh
              position={[0, rockCenterY, 0]}
            >
              <boxGeometry args={[segment.width, segment.rockLayerHeight, segment.length]} />
              <meshStandardMaterial 
                color="#6A6A6A"
                flatShading 
                roughness={0.9}
                metalness={0.1}
              />
            </mesh>
            
            {/* Dirt Layer (underneath rock) - extends 40 units deep from -0.1 to -40.1 */}
            <mesh
              position={[0, dirtCenterY, 0]}
            >
              <boxGeometry args={[segment.width, segment.dirtLayerHeight, segment.length]} />
              <meshStandardMaterial 
                color="#2A1F15"
                flatShading 
                roughness={1.0}
                metalness={0.0}
              />
            </mesh>
            
            {/* Minerals embedded in dirt */}
            {segment.minerals.map((mineral, minIndex) => {
              const colorMap = {
                iron: "#5A5A5A",
                copper: "#8B6F47",
                gold: "#D4AF37"
              };
              
              return (
                <mesh
                  key={`mineral-${segIndex}-${minIndex}`}
                  position={[mineral.x, mineral.y, mineral.z]}
                >
                  <octahedronGeometry args={[0.15, 0]} />
                  <meshStandardMaterial 
                    color={colorMap[mineral.type]}
                    emissive={colorMap[mineral.type]}
                    emissiveIntensity={0.2}
                    flatShading
                  />
                </mesh>
              );
            })}
            
            {/* Bones embedded in dirt */}
            {segment.bones.map((bone, boneIndex) => {
              // Use bone index to create pseudo-random rotation
              const rotationY = (boneIndex * 137.5) % (Math.PI * 2); // Golden angle for distribution
              return (
                <mesh
                  key={`bone-${segIndex}-${boneIndex}`}
                  position={[bone.x, bone.y, bone.z]}
                  rotation={[0, rotationY, 0]}
                >
                  <boxGeometry args={[bone.size * 0.3, bone.size, bone.size * 0.2]} />
                  <meshStandardMaterial 
                    color="#E8E8E8"
                    flatShading 
                    roughness={0.8}
                    metalness={0.0}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
      
      {/* Platforms */}
      {levelData.platforms.map((platform, index) => {
        if (platform.type === 'crumbling') {
          // Crumbling platforms would need additional logic
          return null;
        }
        
        return (
          <mesh
            key={`platform-${index}`}
            ref={(ref) => {
              if (ref) platformMeshesRef.current.set(index, ref);
            }}
            position={[platform.x, platform.y, platform.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <boxGeometry args={[platform.width, platform.depth, platform.height]} />
            <meshStandardMaterial 
              color={platform.type === 'moving' ? "#7A7A7A" : "#8A8A8A"}
              flatShading 
              roughness={0.7}
              metalness={0.1}
            />
          </mesh>
        );
      })}

      {/* Obstacles (pits, etc.) */}
      {levelData.obstacles.map((obstacle, index) => {
        if (obstacle.type === 'pit') {
          // Render pit as a dark void
          return (
            <mesh
              key={`pit-${index}`}
              position={[obstacle.x, obstacle.y, obstacle.z]}
            >
              <boxGeometry args={[obstacle.width, obstacle.depth, obstacle.height]} />
              <meshStandardMaterial 
                color="#0A0A0A"
                transparent
                opacity={0.8}
              />
            </mesh>
          );
        }
        return null;
      })}

      {/* Crystals */}
      {levelData.crystals.map((crystal) => {
        if (!isCrystalVisible(crystal)) return null;

        const colorMap = {
          red: "#FF6B6B",
          blue: "#4ECDC4",
          green: "#95E1D3"
        };

        return (
          <group
            key={`crystal-${crystal.id}`}
            position={[crystal.x, crystal.y, crystal.z]}
          >
            <GameCrystal color={colorMap[crystal.color]} />
          </group>
        );
      })}

      {/* Targets */}
      {levelData.targets.map((target) => {
        if (target.shot) return null;

        return (
          <group key={`target-${target.id}`} position={[target.x, target.y, target.z]}>
            {target.type === 'lantern' && (
              <>
                <mesh>
                  <cylinderGeometry args={[0.2, 0.2, 0.4, 8]} />
                  <meshStandardMaterial color="#6A6A6A" />
                </mesh>
                <mesh position={[0, 0.3, 0]}>
                  <sphereGeometry args={[0.15, 8, 8]} />
                  <meshStandardMaterial 
                    color="#9A9A9A"
                    emissive="#9A9A9A"
                    emissiveIntensity={0.3}
                  />
                </mesh>
              </>
            )}
            {target.type === 'idol' && (
              <mesh>
                <boxGeometry args={[0.3, 0.6, 0.3]} />
                <meshStandardMaterial color="#5A5A5A" />
              </mesh>
            )}
            {target.type === 'crystal_cluster' && (
              <mesh>
                <octahedronGeometry args={[0.2, 0]} />
                <meshStandardMaterial 
                  color="#7A7A7A"
                  emissive="#7A7A7A"
                  emissiveIntensity={0.2}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Boss Gate */}
      <group position={[levelData.bossGate.x, levelData.bossGate.y, levelData.bossGate.z]}>
        {/* Gate arch */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[3, 4, 0.5]} />
          <meshStandardMaterial color="#4A4A4A" />
        </mesh>
        {/* Runes (glowing when closed) */}
        {!isBossGateOpen && (
          <mesh position={[0, 0, 0.3]}>
            <planeGeometry args={[2, 3]} />
            <meshStandardMaterial 
              color="#9A9A9A"
              emissive="#9A9A9A"
              emissiveIntensity={0.5}
              transparent
              opacity={0.8}
            />
          </mesh>
        )}
        {/* Gate doors (open when crystals collected) */}
        {!isBossGateOpen && (
          <>
            <mesh position={[-1.5, 0, 0]}>
              <boxGeometry args={[0.2, 4, 0.3]} />
              <meshStandardMaterial color="#3A3A3A" />
            </mesh>
            <mesh position={[1.5, 0, 0]}>
              <boxGeometry args={[0.2, 4, 0.3]} />
              <meshStandardMaterial color="#3A3A3A" />
            </mesh>
          </>
        )}
      </group>

      {/* Background Elements */}
      {levelData.background.walls.map((wall, index) => (
        <mesh key={`wall-${index}`} position={[wall.x, wall.y, wall.z]}>
          <boxGeometry args={[wall.width, wall.height, wall.depth]} />
          <meshStandardMaterial color="#3A3A3A" flatShading />
        </mesh>
      ))}

      {levelData.background.floor.map((floor, index) => (
        <mesh key={`floor-${index}`} position={[floor.x, floor.y, floor.z]}>
          <boxGeometry args={[floor.width, floor.depth, floor.height]} />
          <meshStandardMaterial color="#2A2A2A" flatShading />
        </mesh>
      ))}

      {levelData.background.ceiling.map((ceiling, index) => (
        <mesh key={`ceiling-${index}`} position={[ceiling.x, ceiling.y, ceiling.z]}>
          <boxGeometry args={[ceiling.width, ceiling.depth, ceiling.height]} />
          <meshStandardMaterial color="#4A4A4A" flatShading />
        </mesh>
      ))}

      {/* Lighting Sources (visual representation + actual lights) */}
      {levelData.lighting.map((light, index) => (
        <group key={`light-${index}`} position={[light.x, light.y, light.z]}>
          {/* Actual Three.js light */}
          <pointLight
            position={[0, 0, 0]}
            intensity={light.intensity * 0.5}
            distance={10}
            decay={2}
            color="#ffffff"
          />
          
          {/* Visual representation */}
          {light.type === 'torch' && (
            <>
              <mesh>
                <cylinderGeometry args={[0.1, 0.1, 0.3, 8]} />
                <meshStandardMaterial color="#5A5A5A" />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <sphereGeometry args={[0.15, 8, 8]} />
                <meshStandardMaterial 
                  color="#AAAAAA"
                  emissive="#AAAAAA"
                  emissiveIntensity={light.intensity}
                />
              </mesh>
            </>
          )}
          {light.type === 'mushroom' && (
            <mesh>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial 
                color="#7A7A7A"
                emissive="#7A7A7A"
                emissiveIntensity={light.intensity}
              />
            </mesh>
          )}
          {light.type === 'crystal' && (
            <mesh>
              <octahedronGeometry args={[0.15, 0]} />
              <meshStandardMaterial 
                color="#AAAAAA"
                emissive="#AAAAAA"
                emissiveIntensity={light.intensity}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

