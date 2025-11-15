"use client";

import { useRef, useMemo } from "react";
import { useFrame, Canvas } from "@react-three/fiber";
import { Mesh, BufferGeometry, NormalBufferAttributes, Material, Object3DEventMap } from "three";
import * as THREE from "three";

interface CrystalProps {
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
    // Use OctahedronGeometry for diamond-shaped sparkles
    return new THREE.OctahedronGeometry(0.06, 0);
  }, []);
  
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: sparkleColor,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      flatShading: true, // Sharp edges for diamond look
    });
  }, [sparkleColor]);
  
  useFrame((state) => {
    if (meshRef.current && material) {
      const time = state.clock.elapsedTime;
      const twinkle = (Math.sin(time * speed + phase) + 1) * 0.5;
      
      // Twinkle opacity and scale
      material.opacity = 0.3 + twinkle * 0.7;
      const scale = 0.5 + twinkle * 1.5;
      meshRef.current.scale.set(scale, scale, scale);
      
      // Rotate the diamond sparkle for extra sparkle effect
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
  
  // Create sparkle data - fixed on mount
  const sparkles = useMemo(() => {
    return Array.from({ length: count }, () => {
      const radius = 2.5 + Math.random() * 1.5;
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
  
  // Rotate the entire sparkle system
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

function Crystal({ color }: CrystalProps) {
  const meshRef = useRef<Mesh<BufferGeometry<NormalBufferAttributes>, Material | Material[], Object3DEventMap>>(null);
  const glowRef = useRef<Mesh<BufferGeometry<NormalBufferAttributes>, Material | Material[], Object3DEventMap>>(null);
  const outerGlowRef = useRef<Mesh<BufferGeometry<NormalBufferAttributes>, Material | Material[], Object3DEventMap>>(null);

  // Saturate the color - increased saturation for more vibrant look
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
    // Top point
    const top = [0, 2, 0];
    // Bottom point
    const bottom = [0, -2, 0];
    
    // Create blocky rings - fewer points for more angular look
    const numSides = 6; // Hexagonal for blocky look
    
    // Top ring (smaller)
    const topRingRadius = 0.6;
    const topRingY = 1.2;
    const topRingPoints: number[][] = [];
    for (let i = 0; i < numSides; i++) {
      const angle = (i / numSides) * Math.PI * 2;
      topRingPoints.push([
        Math.cos(angle) * topRingRadius,
        topRingY,
        Math.sin(angle) * topRingRadius
      ]);
    }
    
    // Middle ring (widest)
    const middleRingRadius = 1.4;
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
    
    // Lower ring
    const lowerRingRadius = 0.8;
    const lowerRingY = -1.2;
    const lowerRingPoints: number[][] = [];
    for (let i = 0; i < numSides; i++) {
      const angle = (i / numSides) * Math.PI * 2;
      lowerRingPoints.push([
        Math.cos(angle) * lowerRingRadius,
        lowerRingY,
        Math.sin(angle) * lowerRingRadius
      ]);
    }

    // Helper function to add triangle with blocky normals
    const addTriangle = (v1: number[], v2: number[], v3: number[]) => {
      const startIndex = vertices.length / 3;
      vertices.push(...v1, ...v2, ...v3);
      
      // Calculate normal for flat shading (blocky look)
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
      
      // Use same normal for all vertices (flat shading = blocky)
      normals.push(
        normalized[0], normalized[1], normalized[2],
        normalized[0], normalized[1], normalized[2],
        normalized[0], normalized[1], normalized[2]
      );
      
      indices.push(startIndex, startIndex + 1, startIndex + 2);
      uvs.push(0, 0, 1, 0, 0.5, 1);
    };

    // Top facets - from top point to top ring
    for (let i = 0; i < numSides; i++) {
      const next = (i + 1) % numSides;
      addTriangle(top, topRingPoints[i], topRingPoints[next]);
    }

    // Top ring to middle ring facets
    for (let i = 0; i < numSides; i++) {
      const next = (i + 1) % numSides;
      addTriangle(topRingPoints[i], middleRingPoints[i], middleRingPoints[next]);
      addTriangle(topRingPoints[i], middleRingPoints[next], topRingPoints[next]);
    }

    // Middle ring to lower ring facets
    for (let i = 0; i < numSides; i++) {
      const next = (i + 1) % numSides;
      addTriangle(middleRingPoints[i], lowerRingPoints[i], lowerRingPoints[next]);
      addTriangle(middleRingPoints[i], lowerRingPoints[next], middleRingPoints[next]);
    }

    // Lower ring to bottom facets
    for (let i = 0; i < numSides; i++) {
      const next = (i + 1) % numSides;
      addTriangle(lowerRingPoints[i], bottom, lowerRingPoints[next]);
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    // Don't smooth normals - keep it blocky!
    geom.computeVertexNormals();

    return geom;
  }, []);

  // Create glow geometry (slightly larger)
  const glowGeometry = useMemo(() => {
    const geom = geometry.clone();
    geom.scale(1.15, 1.15, 1.15); // Make it slightly bigger for glow
    return geom;
  }, [geometry]);

  // Create outer glow geometry (even larger)
  const outerGlowGeometry = useMemo(() => {
    const geom = geometry.clone();
    geom.scale(1.3, 1.3, 1.3); // Make it even bigger for outer glow
    return geom;
  }, [geometry]);

  // Rotate the crystal slowly
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.6; // Slightly faster rotation
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.15; // More wobble
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

  // Main crystal material - blocky and glowing with saturated color
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: saturatedColor,
      metalness: 0.2,
      roughness: 0.6, // Slightly shinier
      emissive: glowColor,
      emissiveIntensity: 6.0, // Even stronger glow for more saturation
      transparent: true,
      opacity: 1.0, // Fully opaque for brightness
      flatShading: true, // Blocky, pixelated look
    });
  }, [saturatedColor, glowColor]);

  // Inner glow material
  const glowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 1.0, // Maximum brightness for glow
      side: THREE.BackSide, // Render from inside
    });
  }, [glowColor]);

  // Outer glow material (softer, more diffused)
  const outerGlowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.6, // Much brighter outer glow
      side: THREE.BackSide,
    });
  }, [glowColor]);

  return (
    <>
      {/* Very strong ambient light for overall brightness */}
      <ambientLight intensity={2.0} />
      
      {/* Multiple strong directional lights for better illumination */}
      <directionalLight position={[5, 5, 5]} intensity={4.0} />
      <directionalLight position={[-5, 5, -5]} intensity={3.5} />
      <directionalLight position={[0, 5, 0]} intensity={3.0} />
      <directionalLight position={[5, -5, 5]} intensity={2.5} />
      <directionalLight position={[-5, -5, -5]} intensity={2.5} />
      
      {/* Very strong point lights with crystal color for intense glow effect */}
      <pointLight position={[0, 0, 0]} intensity={8.0} color={glowColor} distance={20} decay={1.0} />
      <pointLight position={[-3, -3, -3]} intensity={5.0} color={glowColor} distance={18} decay={1.0} />
      <pointLight position={[3, 3, 3]} intensity={5.0} color={glowColor} distance={18} decay={1.0} />
      <pointLight position={[0, 2, 0]} intensity={6.0} color={glowColor} distance={15} decay={1.0} />
      <pointLight position={[0, -2, 0]} intensity={5.0} color={glowColor} distance={15} decay={1.0} />
      <pointLight position={[4, 0, 0]} intensity={4.0} color={glowColor} distance={15} />
      <pointLight position={[-4, 0, 0]} intensity={4.0} color={glowColor} distance={15} />
      <pointLight position={[0, 0, 4]} intensity={4.0} color={glowColor} distance={15} />
      <pointLight position={[0, 0, -4]} intensity={4.0} color={glowColor} distance={15} />
      
      {/* Outer glow layer (softest) */}
      <mesh ref={outerGlowRef} geometry={outerGlowGeometry} material={outerGlowMaterial} />
      
      {/* Inner glow layer */}
      <mesh ref={glowRef} geometry={glowGeometry} material={glowMaterial} />
      
      {/* Main crystal */}
      <mesh ref={meshRef} geometry={geometry} material={material} />
      
      {/* Sparkle particles */}
      <Sparkles color={color} count={40} />
    </>
  );
}

interface ColorCrystal3DProps {
  color: string;
  size?: number;
}

export default function ColorCrystal3D({ color, size = 80 }: ColorCrystal3DProps) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: "relative",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
        gl={{ antialias: false }} // Disable antialiasing for pixelated look
      >
        <Crystal color={color} />
      </Canvas>
    </div>
  );
}
