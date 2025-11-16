"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, BufferGeometry, NormalBufferAttributes, Material, Object3DEventMap } from "three";
import * as THREE from "three";

interface GameCrystalProps {
  color: string;
}

// Helper function to increase color saturation
function saturateColor(hex: string, amount: number = 1.5): string {
  const rgb = hex.match(/\w\w/g)?.map((x) => parseInt(x, 16)) || [0, 0, 0];
  const [r, g, b] = rgb;
  
  // Convert to HSL for saturation adjustment
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  let s = 0;
  let h = 0;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    if (max === r / 255) h = ((g - b) / 255) / d + (g < b ? 6 : 0);
    else if (max === g / 255) h = ((b - r) / 255) / d + 2;
    else h = ((r - g) / 255) / d + 4;
    h /= 6;
  }
  
  // Increase saturation
  s = Math.min(1, s * amount);
  
  // Convert back to RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  
  let newR = 0, newG = 0, newB = 0;
  if (h < 1/6) { newR = c; newG = x; newB = 0; }
  else if (h < 2/6) { newR = x; newG = c; newB = 0; }
  else if (h < 3/6) { newR = 0; newG = c; newB = x; }
  else if (h < 4/6) { newR = 0; newG = x; newB = c; }
  else if (h < 5/6) { newR = x; newG = 0; newB = c; }
  else { newR = c; newG = 0; newB = x; }
  
  newR = Math.round((newR + m) * 255);
  newG = Math.round((newG + m) * 255);
  newB = Math.round((newB + m) * 255);
  
  return `#${[newR, newG, newB].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

// Individual sparkle component
function Sparkle({ 
  position, 
  color, 
  speed, 
  phase 
}: { 
  position: [number, number, number]; 
  color: string; 
  speed: number; 
  phase: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const sparkleColor = useMemo(() => saturateColor(color, 3.5), [color]);
  
  const geometry = useMemo(() => {
    return new THREE.OctahedronGeometry(0.06, 0);
  }, []);
  
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: sparkleColor,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [sparkleColor]);
  
  useFrame((state) => {
    if (meshRef.current && material) {
      const time = state.clock.elapsedTime;
      const twinkle = (Math.sin(time * speed + phase) + 1) * 0.5;
      
      material.opacity = 0.3 + twinkle * 0.7;
      const scale = 0.5 + twinkle * 1.5;
      meshRef.current.scale.set(scale, scale, scale);
      
      meshRef.current.rotation.x = time * 2 + phase;
      meshRef.current.rotation.y = time * 2.5 + phase;
      meshRef.current.rotation.z = time * 1.5 + phase;
    }
  });
  
  return (
    <mesh ref={meshRef} position={position} geometry={geometry} material={material} />
  );
}

// Sparkle particle system component
function Sparkles({ color, count = 35 }: { color: string; count?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  const sparkles = useMemo(() => {
    return Array.from({ length: count }, () => {
      const radius = 0.5 + Math.random() * 0.3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      return {
        position: [
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi)
        ] as [number, number, number],
        speed: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      };
    });
  }, [count]);
  
  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime;
      groupRef.current.rotation.y = time * 0.2;
      groupRef.current.rotation.x = Math.sin(time * 0.1) * 0.3;
    }
  });
  
  return (
    <group ref={groupRef}>
      {sparkles.map((sparkle, i) => (
        <Sparkle
          key={i}
          position={sparkle.position}
          color={color}
          speed={sparkle.speed}
          phase={sparkle.phase}
        />
      ))}
    </group>
  );
}

export default function GameCrystal({ color }: GameCrystalProps) {
  const meshRef = useRef<Mesh<BufferGeometry<NormalBufferAttributes>, Material | Material[], Object3DEventMap>>(null);
  const glowRef = useRef<Mesh<BufferGeometry<NormalBufferAttributes>, Material | Material[], Object3DEventMap>>(null);
  const outerGlowRef = useRef<Mesh<BufferGeometry<NormalBufferAttributes>, Material | Material[], Object3DEventMap>>(null);

  const saturatedColor = useMemo(() => saturateColor(color, 2.5), [color]);
  const glowColor = useMemo(() => saturateColor(color, 3.0), [color]);

  // Create a blocky, pixelated crystal geometry
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    // Create a blocky diamond/crystal shape with sharp, pixelated edges
    const top = [0, 0.3, 0];
    const bottom = [0, -0.3, 0];
    
    const numSides = 6;
    
    const topRingRadius = 0.09;
    const topRingY = 0.18;
    const topRingPoints: number[][] = [];
    for (let i = 0; i < numSides; i++) {
      const angle = (i / numSides) * Math.PI * 2;
      topRingPoints.push([
        Math.cos(angle) * topRingRadius,
        topRingY,
        Math.sin(angle) * topRingRadius
      ]);
    }
    
    const middleRingRadius = 0.21;
    const middleRingY = 0;
    const middleRingPoints: number[][] = [];
    for (let i = 0; i < numSides; i++) {
      const angle = (i / numSides) * Math.PI * 2;
      middleRingPoints.push([
        Math.cos(angle) * middleRingRadius,
        middleRingY,
        Math.sin(angle) * middleRingRadius
      ]);
    }
    
    const lowerRingRadius = 0.12;
    const lowerRingY = -0.18;
    const lowerRingPoints: number[][] = [];
    for (let i = 0; i < numSides; i++) {
      const angle = (i / numSides) * Math.PI * 2;
      lowerRingPoints.push([
        Math.cos(angle) * lowerRingRadius,
        lowerRingY,
        Math.sin(angle) * lowerRingRadius
      ]);
    }

    const addTriangle = (v1: number[], v2: number[], v3: number[]) => {
      const startIndex = vertices.length / 3;
      vertices.push(...v1, ...v2, ...v3);
      
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
      const normal = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
      ];
      const length = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
      const normalized = [
        normal[0] / length,
        normal[1] / length,
        normal[2] / length
      ];
      
      normals.push(
        normalized[0], normalized[1], normalized[2],
        normalized[0], normalized[1], normalized[2],
        normalized[0], normalized[1], normalized[2]
      );
      
      indices.push(startIndex, startIndex + 1, startIndex + 2);
      uvs.push(0, 0, 1, 0, 0.5, 1);
    };

    for (let i = 0; i < numSides; i++) {
      const next = (i + 1) % numSides;
      addTriangle(top, topRingPoints[i], topRingPoints[next]);
    }

    for (let i = 0; i < numSides; i++) {
      const next = (i + 1) % numSides;
      addTriangle(topRingPoints[i], middleRingPoints[i], middleRingPoints[next]);
      addTriangle(topRingPoints[i], middleRingPoints[next], topRingPoints[next]);
    }

    for (let i = 0; i < numSides; i++) {
      const next = (i + 1) % numSides;
      addTriangle(middleRingPoints[i], lowerRingPoints[i], lowerRingPoints[next]);
      addTriangle(middleRingPoints[i], lowerRingPoints[next], middleRingPoints[next]);
    }

    for (let i = 0; i < numSides; i++) {
      const next = (i + 1) % numSides;
      addTriangle(lowerRingPoints[i], bottom, lowerRingPoints[next]);
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    return geom;
  }, []);

  const glowGeometry = useMemo(() => {
    const geom = geometry.clone();
    geom.scale(1.15, 1.15, 1.15);
    return geom;
  }, [geometry]);

  const outerGlowGeometry = useMemo(() => {
    const geom = geometry.clone();
    geom.scale(1.3, 1.3, 1.3);
    return geom;
  }, [geometry]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.6;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
    }
    if (glowRef.current) {
      glowRef.current.rotation.y = meshRef.current?.rotation.y || 0;
      glowRef.current.rotation.x = meshRef.current?.rotation.x || 0;
    }
    if (outerGlowRef.current) {
      outerGlowRef.current.rotation.y = meshRef.current?.rotation.y || 0;
      outerGlowRef.current.rotation.x = meshRef.current?.rotation.x || 0;
    }
  });

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: saturatedColor,
      metalness: 0.2,
      roughness: 0.6,
      emissive: glowColor,
      emissiveIntensity: 6.0,
      transparent: true,
      opacity: 1.0,
      flatShading: true,
    });
  }, [saturatedColor, glowColor]);

  const glowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 1.0,
      side: THREE.BackSide,
    });
  }, [glowColor]);

  const outerGlowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.6,
      side: THREE.BackSide,
    });
  }, [glowColor]);

  return (
    <group>
      {/* Point light for crystal glow */}
      <pointLight position={[0, 0, 0]} intensity={2.0} color={glowColor} distance={5} decay={1.0} />
      
      {/* Outer glow layer */}
      <mesh ref={outerGlowRef} geometry={outerGlowGeometry} material={outerGlowMaterial} />
      
      {/* Inner glow layer */}
      <mesh ref={glowRef} geometry={glowGeometry} material={glowMaterial} />
      
      {/* Main crystal */}
      <mesh ref={meshRef} geometry={geometry} material={material} />
      
      {/* Sparkle particles */}
      <Sparkles color={color} count={20} />
    </group>
  );
}

