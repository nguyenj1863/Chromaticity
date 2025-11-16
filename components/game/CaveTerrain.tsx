"use client";

import { useMemo } from "react";
import * as THREE from "three";

export default function CaveTerrain() {
  // Create 2D platform - long grey platform extending forward (like Temple Run)
  const platformLength = 100; // Long platform for running
  const platformWidth = 4;
  
  // Create pixelated cave background (black, white, grey only)
  const caveWallGeometry = useMemo(() => {
    // Create a large plane for the cave background
    const geometry = new THREE.PlaneGeometry(50, 30, 20, 15);
    
    // Add pixelated cave texture using vertex colors
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      
      // Create pixelated cave pattern (black, white, grey blocks)
      const blockX = Math.floor(x / 2) * 2;
      const blockY = Math.floor(y / 2) * 2;
      const noise = (Math.sin(blockX * 0.3) + Math.cos(blockY * 0.3)) * 0.5 + 0.5;
      
      // Map to grey scale (0 = black, 0.5 = grey, 1 = white)
      const greyValue = noise * 0.3 + 0.1; // Mostly dark grey/black
      colors[i * 3] = greyValue;
      colors[i * 3 + 1] = greyValue;
      colors[i * 3 + 2] = greyValue;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, []);

  return (
    <>
      {/* 2D Platform - Grey platform extending forward */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <boxGeometry args={[platformWidth, platformLength, 0.2]} />
        <meshStandardMaterial 
          color="#AAAAAA" 
          flatShading 
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Cave Background - Pixelated cave wall behind platform (facing camera from side view) */}
      <mesh 
        position={[-8, 5, 0]} 
        rotation={[0, Math.PI / 2, 0]}
        geometry={caveWallGeometry}
      >
        <meshStandardMaterial 
          vertexColors
          flatShading 
          roughness={1.0}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cave Ceiling - Pixelated top */}
      <mesh 
        position={[0, 12, -5]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <boxGeometry args={[50, 30, 1]} />
        <meshStandardMaterial 
          color="#6A6A6A" 
          flatShading 
          roughness={1.0}
        />
      </mesh>

      {/* Cave Floor Background - Below platform */}
      <mesh 
        position={[0, -2, -5]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <boxGeometry args={[50, 30, 1]} />
        <meshStandardMaterial 
          color="#4A4A4A" 
          flatShading 
          roughness={1.0}
        />
      </mesh>
    </>
  );
}

