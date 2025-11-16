// Phaser-based level generator for the solo game map
// Generates a finite cave level with obstacles, crystals, targets, and boss gate

export interface Platform {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  type: 'static' | 'moving' | 'crumbling' | 'ground';
  moveDirection?: 'left' | 'right';
  moveDistance?: number;
  moveSpeed?: number;
  // Ground-specific properties
  rockLayerHeight?: number;
  dirtLayerHeight?: number;
  minerals?: Array<{ x: number; y: number; z: number; type: 'iron' | 'copper' | 'gold' }>;
  bones?: Array<{ x: number; y: number; z: number; size: number }>;
}

export interface Obstacle {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  type: 'pit' | 'ledge' | 'floating_platform' | 'arc_formation';
}

export interface Crystal {
  id: number;
  x: number;
  y: number;
  z: number;
  color: 'red' | 'blue' | 'green';
  state: 'visible' | 'hidden' | 'collected';
  requiresTarget?: number; // Target ID that must be shot to reveal this crystal
}

export interface Target {
  id: number;
  x: number;
  y: number;
  z: number;
  type: 'lantern' | 'idol' | 'crystal_cluster';
  shot: boolean;
}

export interface BossGate {
  x: number;
  y: number;
  z: number;
  open: boolean;
  requiredCrystals: number;
}

export interface LevelData {
  platforms: Platform[];
  obstacles: Obstacle[];
  crystals: Crystal[];
  targets: Target[];
  bossGate: BossGate;
  ground: {
    segments: Array<{
      z: number;
      width: number;
      length: number;
      rockLayerHeight: number;
      dirtLayerHeight: number;
      minerals: Array<{ x: number; y: number; z: number; type: 'iron' | 'copper' | 'gold' }>;
      bones: Array<{ x: number; y: number; z: number; size: number }>;
    }>;
  };
  background: {
    walls: Array<{ x: number; y: number; z: number; width: number; height: number; depth: number }>;
    floor: Array<{ x: number; y: number; z: number; width: number; height: number; depth: number }>;
    ceiling: Array<{ x: number; y: number; z: number; width: number; height: number; depth: number }>;
  };
  lighting: Array<{ x: number; y: number; z: number; intensity: number; type: 'torch' | 'mushroom' | 'crystal' }>;
}

// Simple RNG for consistent generation
class LevelRNG {
  private seed: number;

  constructor(seed: number = 12345) {
    this.seed = seed;
  }

  random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  between(min: number, max: number): number {
    return min + (max - min) * this.random();
  }
}

export class LevelGenerator {
  private rng: LevelRNG;
  private levelLength: number;

  constructor(seed: number = 12345) {
    this.rng = new LevelRNG(seed);
    this.levelLength = 200; // Finite level length
  }

  generateLevel(): LevelData {
    const platforms: Platform[] = [];
    const obstacles: Obstacle[] = [];
    const crystals: Crystal[] = [];
    const targets: Target[] = [];
    const ground = {
      segments: [] as Array<{
        z: number;
        width: number;
        length: number;
        rockLayerHeight: number;
        dirtLayerHeight: number;
        minerals: Array<{ x: number; y: number; z: number; type: 'iron' | 'copper' | 'gold' }>;
        bones: Array<{ x: number; y: number; z: number; size: number }>;
      }>,
    };
    const background = {
      walls: [] as Array<{ x: number; y: number; z: number; width: number; height: number; depth: number }>,
      floor: [] as Array<{ x: number; y: number; z: number; width: number; height: number; depth: number }>,
      ceiling: [] as Array<{ x: number; y: number; z: number; width: number; height: number; depth: number }>,
    };
    const lighting: Array<{ x: number; y: number; z: number; intensity: number; type: 'torch' | 'mushroom' | 'crystal' }> = [];

    // ===== GENERATE GROUND SEGMENTS =====
    // Generate ground segments with rock and dirt layers, minerals and bones
    // Make segments overlap slightly to ensure continuous coverage
    const groundSegmentLength = 10;
    const numGroundSegments = Math.ceil(this.levelLength / groundSegmentLength) + 1; // +1 to ensure full coverage
    
    for (let i = 0; i < numGroundSegments; i++) {
      const z = -this.levelLength / 2 + i * groundSegmentLength;
      const segmentZ = z + groundSegmentLength / 2;
      
      // Generate minerals and bones for this segment
      const minerals: Array<{ x: number; y: number; z: number; type: 'iron' | 'copper' | 'gold' }> = [];
      const bones: Array<{ x: number; y: number; z: number; size: number }> = [];
      
      // Add 8-15 minerals per segment (distributed throughout deep dirt layer)
      const numMinerals = Math.floor(this.rng.between(8, 16));
      for (let j = 0; j < numMinerals; j++) {
        const mineralTypes: Array<'iron' | 'copper' | 'gold'> = ['iron', 'copper', 'gold'];
        minerals.push({
          x: this.rng.between(-5, 5), // Wider distribution for wider ground
          y: -this.rng.between(0.5, 39.0), // Embedded throughout 40-unit deep dirt layer
          z: this.rng.between(-groundSegmentLength / 2, groundSegmentLength / 2),
          type: mineralTypes[Math.floor(this.rng.between(0, mineralTypes.length))]
        });
      }
      
      // Add 4-8 bones per segment (distributed throughout deep dirt layer)
      const numBones = Math.floor(this.rng.between(4, 9));
      for (let j = 0; j < numBones; j++) {
        bones.push({
          x: this.rng.between(-5, 5), // Wider distribution for wider ground
          y: -this.rng.between(0.3, 38.0), // Embedded throughout 40-unit deep dirt layer
          z: this.rng.between(-groundSegmentLength / 2, groundSegmentLength / 2),
          size: this.rng.between(0.1, 0.3)
        });
      }
      
      ground.segments.push({
        z: segmentZ,
        width: 12, // Wider to cover more of camera view
        length: groundSegmentLength,
        rockLayerHeight: 0.3, // Top rock layer
        dirtLayerHeight: 40.0, // Dirt layer underneath - extends 40 units deep
        minerals,
        bones
      });
    }

    // ===== START ZONE (z: 0 to 20) =====
    // Note: Ground is now handled by ground.segments above
    // Platforms below are for elevated surfaces (ledges, floating platforms, etc.)

    // Small teaching jump - shallow pit
    obstacles.push({
      x: 0, y: -1, z: 15,
      width: 4, height: 1, depth: 3,
      type: 'pit'
    });

    platforms.push({
      x: 0, y: 0.2, z: 18,
      width: 4, height: 0.2, depth: 2,
      type: 'static'
    });

    // Crystal 1 - Easy to grab on main path
    crystals.push({
      id: 1,
      x: 0, y: 1.5, z: 10,
      color: 'red',
      state: 'visible'
    });

    // ===== MID CAVE (z: 20 to 150) =====
    let currentZ = 20;

    // Section 1: Staggered rocky ledges
    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 5,
      type: 'static'
    });
    currentZ += 5;

    platforms.push({
      x: 0, y: 1.2, z: currentZ,
      width: 3, height: 0.2, depth: 4,
      type: 'static'
    });
    currentZ += 4;

    platforms.push({
      x: 0, y: 2.2, z: currentZ,
      width: 2.5, height: 0.2, depth: 3,
      type: 'static'
    });
    currentZ += 3;

    platforms.push({
      x: 0, y: 1.2, z: currentZ,
      width: 3, height: 0.2, depth: 4,
      type: 'static'
    });
    currentZ += 4;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 5,
      type: 'static'
    });
    currentZ += 5;

    // Section 2: Pits and chasms
    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 4,
      type: 'static'
    });
    currentZ += 4;

    obstacles.push({
      x: 0, y: -2, z: currentZ,
      width: 4, height: 2, depth: 6,
      type: 'pit'
    });
    currentZ += 6;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 4,
      type: 'static'
    });
    currentZ += 4;

    // Section 3: Floating stone platforms
    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 3,
      type: 'static'
    });
    currentZ += 3;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 2, height: 0.2, depth: 2,
      type: 'static'
    });
    currentZ += 4;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 2, height: 0.2, depth: 2,
      type: 'static'
    });
    currentZ += 4;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 2, height: 0.2, depth: 2,
      type: 'static'
    });
    currentZ += 4;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 3,
      type: 'static'
    });
    currentZ += 3;

    // Section 4: Target and Crystal 2
    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 5,
      type: 'static'
    });

    // Target (lantern) on the wall
    targets.push({
      id: 1,
      x: -3, y: 2, z: currentZ + 2.5,
      type: 'lantern',
      shot: false
    });

    // Crystal 2 - Hidden, appears after shooting target
    crystals.push({
      id: 2,
      x: 0, y: 1.5, z: currentZ + 2.5,
      color: 'blue',
      state: 'hidden',
      requiresTarget: 1
    });

    currentZ += 5;

    // Section 5: Arc-shaped rock formations
    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 3,
      type: 'static'
    });
    currentZ += 3;

    // Arc formation - multiple small platforms
    platforms.push({
      x: -1, y: 1.2, z: currentZ,
      width: 1.5, height: 0.2, depth: 1.5,
      type: 'static'
    });
    platforms.push({
      x: 0, y: 1.8, z: currentZ + 1.5,
      width: 1.5, height: 0.2, depth: 1.5,
      type: 'static'
    });
    platforms.push({
      x: 1, y: 1.2, z: currentZ + 3,
      width: 1.5, height: 0.2, depth: 1.5,
      type: 'static'
    });
    currentZ += 5;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 3,
      type: 'static'
    });
    currentZ += 3;

    // Section 6: Moving platform
    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 3,
      type: 'static'
    });
    currentZ += 3;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 2, height: 0.2, depth: 2,
      type: 'moving',
      moveDirection: 'left',
      moveDistance: 2,
      moveSpeed: 1
    });
    currentZ += 6;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 3,
      type: 'static'
    });
    currentZ += 3;

    // Section 7: Crystal 3 - Tricky jump sequence
    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 3,
      type: 'static'
    });
    currentZ += 3;

    // High ledges leading to crystal
    platforms.push({
      x: 0, y: 2.2, z: currentZ,
      width: 2, height: 0.2, depth: 2,
      type: 'static'
    });
    currentZ += 4;

    platforms.push({
      x: 0, y: 3.2, z: currentZ,
      width: 1.5, height: 0.2, depth: 1.5,
      type: 'static'
    });
    currentZ += 3;

    // Crystal 3 on highest platform
    crystals.push({
      id: 3,
      x: 0, y: 3.8, z: currentZ - 1.5,
      color: 'green',
      state: 'visible'
    });

    platforms.push({
      x: 0, y: 2.2, z: currentZ,
      width: 2, height: 0.2, depth: 2,
      type: 'static'
    });
    currentZ += 4;

    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 3,
      type: 'static'
    });
    currentZ += 3;

    // ===== BOSS GATE AND ARENA (z: 150 to 200) =====
    // Final platform before gate
    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 4, height: 0.2, depth: 5,
      type: 'static'
    });
    currentZ += 5;

    // Boss gate
    const bossGate: BossGate = {
      x: 0,
      y: 2,
      z: currentZ,
      open: false,
      requiredCrystals: 3
    };
    currentZ += 2;

    // Boss arena - large flat chamber
    platforms.push({
      x: 0, y: 0.2, z: currentZ,
      width: 8, height: 0.2, depth: 20,
      type: 'static'
    });

    // ===== BACKGROUND ELEMENTS =====
    // Generate cave walls, floor, and ceiling along the level
    for (let z = 0; z < this.levelLength; z += 10) {
      // Left wall
      background.walls.push({
        x: -6, y: 5, z: z,
        width: 1, height: 20, depth: 10
      });
      // Right wall
      background.walls.push({
        x: 6, y: 5, z: z,
        width: 1, height: 20, depth: 10
      });
      // Back wall (behind camera)
      background.walls.push({
        x: 0, y: 5, z: z,
        width: 12, height: 20, depth: 1
      });

      // Floor
      background.floor.push({
        x: 0, y: -3, z: z,
        width: 12, height: 1, depth: 10
      });

      // Ceiling
      background.ceiling.push({
        x: 0, y: 15, z: z,
        width: 12, height: 1, depth: 10
      });
    }

    // ===== LIGHTING =====
    // Add torches, glowing mushrooms, and luminous crystals for visibility
    for (let z = 5; z < this.levelLength; z += 15) {
      // Torches on walls
      lighting.push({
        x: -5.5, y: 3, z: z,
        intensity: 0.8,
        type: 'torch'
      });
      lighting.push({
        x: 5.5, y: 3, z: z,
        intensity: 0.8,
        type: 'torch'
      });
    }

    // Glowing mushrooms near obstacles
    lighting.push({ x: -2, y: 0.5, z: 25, intensity: 0.5, type: 'mushroom' });
    lighting.push({ x: 2, y: 0.5, z: 50, intensity: 0.5, type: 'mushroom' });
    lighting.push({ x: -2, y: 0.5, z: 100, intensity: 0.5, type: 'mushroom' });

    // Luminous crystals near crystals
    lighting.push({ x: 0, y: 1.5, z: 10, intensity: 1.0, type: 'crystal' });
    lighting.push({ x: 0, y: 1.5, z: 80, intensity: 1.0, type: 'crystal' });
    lighting.push({ x: 0, y: 3.8, z: 120, intensity: 1.0, type: 'crystal' });

    // Extra lighting in boss arena
    for (let z = currentZ; z < currentZ + 20; z += 5) {
      lighting.push({ x: -3, y: 3, z: z, intensity: 1.2, type: 'torch' });
      lighting.push({ x: 3, y: 3, z: z, intensity: 1.2, type: 'torch' });
    }

    return {
      platforms,
      obstacles,
      crystals,
      targets,
      bossGate,
      ground,
      background,
      lighting
    };
  }
}

