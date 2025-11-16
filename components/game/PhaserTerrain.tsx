"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { PhaserTerrainGenerator, TerrainData } from "@/lib/phaserTerrain";

interface PhaserTerrainProps {
  onTerrainData?: (data: TerrainData) => void;
}

export default function PhaserTerrain({ onTerrainData }: PhaserTerrainProps) {
  // Generate terrain data using Phaser
  const terrainData = useMemo(() => {
    try {
      const generator = new PhaserTerrainGenerator(100, 4, 2);
      const data = generator.generateTerrain();
      
      // Notify parent of terrain data for physics
      if (onTerrainData) {
        onTerrainData(data);
      }
      
      return data;
    } catch (error) {
      console.error("Error generating terrain:", error);
      // Return minimal terrain data to prevent crash
      return {
        platform: { segments: [] },
        obstacles: [],
        background: { walls: [], ceiling: [], floor: [] }
      };
    }
  }, [onTerrainData]);

  // Generate cave texture using Phaser
  const caveTexture = useMemo(() => {
    const generator = new PhaserTerrainGenerator();
    return generator.generateCaveTexture(50, 30, 2);
  }, []);

  // Platform is a single continuous mesh (simpler and more performant)
  const platformLength = 100;
  const platformWidth = 4;

  // Create cave wall geometry with Phaser-generated texture
  const caveWallGeometry = useMemo(() => {
    const width = 50;
    const height = 30;
    const segmentsX = 20;
    const segmentsY = 15;
    const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
    
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    // Ensure caveTexture is valid
    if (!caveTexture || caveTexture.length === 0) {
      // Fallback: create simple pattern
      for (let i = 0; i < positions.count; i++) {
        const greyValue = 0.2;
        colors[i * 3] = greyValue;
        colors[i * 3 + 1] = greyValue;
        colors[i * 3 + 2] = greyValue;
      }
    } else {
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        
        // Map to texture coordinates
        const tileX = Math.floor((x + width / 2) / 2);
        const tileY = Math.floor((y + height / 2) / 2);
        
        let greyValue = 0.2; // Default dark grey
        if (tileY >= 0 && tileY < caveTexture.length && tileX >= 0 && tileX < caveTexture[tileY]?.length) {
          greyValue = Math.max(0.1, Math.min(0.5, caveTexture[tileY][tileX]));
        }
        
        colors[i * 3] = greyValue;
        colors[i * 3 + 1] = greyValue;
        colors[i * 3 + 2] = greyValue;
      }
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, [caveTexture]);

  return (
    <>
      {/* Platform - Generated with Phaser, rendered in Three.js */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <boxGeometry args={[platformWidth, platformLength, 0.2]} />
        <meshStandardMaterial 
          color="#8A8A8A" 
          flatShading 
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Cave Background - Generated with Phaser texture */}
      <mesh 
        position={[0, 5, -8]} 
        rotation={[0, 0, 0]}
        geometry={caveWallGeometry}
      >
        <meshStandardMaterial 
          vertexColors
          flatShading 
          roughness={1.0}
          metalness={0.0}
        />
      </mesh>

      {/* Cave Ceiling - Generated from Phaser data */}
      {terrainData.background.ceiling.map((segment, idx) => (
        <mesh
          key={`ceiling-${idx}`}
          position={[segment.x, segment.y, -50 + (idx * 100) / terrainData.background.ceiling.length]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <boxGeometry args={[segment.width, 30, segment.height]} />
        <meshStandardMaterial 
          color="#4A4A4A" 
          flatShading 
          roughness={1.0}
        />
        </mesh>
      ))}

      {/* Cave Floor - Generated from Phaser data */}
      {terrainData.background.floor.map((segment, idx) => (
        <mesh
          key={`floor-${idx}`}
          position={[segment.x, segment.y, -50 + (idx * 100) / terrainData.background.floor.length]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <boxGeometry args={[segment.width, 30, segment.height]} />
        <meshStandardMaterial 
          color="#5A5A5A" 
          flatShading 
          roughness={1.0}
        />
        </mesh>
      ))}

      {/* Cave Walls - Generated from Phaser data */}
      {terrainData.background.walls.map((segment, idx) => (
        <mesh
          key={`wall-${idx}`}
          position={[segment.x, segment.y, -50 + (idx * 100) / terrainData.background.walls.length]}
        >
          <boxGeometry args={[segment.width, segment.height, 30]} />
          <meshStandardMaterial 
            color="#3A3A3A" 
            flatShading 
            roughness={1.0}
          />
        </mesh>
      ))}
    </>
  );
}

