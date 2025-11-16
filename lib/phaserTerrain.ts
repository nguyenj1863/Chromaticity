// Phaser terrain generator for game terrain and platform
// Generates terrain data that can be converted to Three.js geometry

// Simple random number generator (Phaser-compatible)
class SimpleRNG {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  between(min: number, max: number): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    const rnd = this.seed / 233280;
    return min + (max - min) * rnd;
  }
}

export interface TerrainData {
  platform: {
    segments: Array<{ x: number; y: number; width: number; height: number }>;
  };
  obstacles: Array<{ x: number; y: number; width: number; height: number; type: string }>;
  background: {
    walls: Array<{ x: number; y: number; width: number; height: number }>;
    ceiling: Array<{ x: number; y: number; width: number; height: number }>;
    floor: Array<{ x: number; y: number; width: number; height: number }>;
  };
}

export class PhaserTerrainGenerator {
  private platformLength: number;
  private platformWidth: number;
  private segmentSize: number;
  private rng: SimpleRNG;

  constructor(platformLength: number = 100, platformWidth: number = 4, segmentSize: number = 2) {
    this.platformLength = platformLength;
    this.platformWidth = platformWidth;
    this.segmentSize = segmentSize;
    this.rng = new SimpleRNG();
  }

  // Generate terrain data using Phaser's utilities
  generateTerrain(): TerrainData {
    // Generate platform segments (can add variation later)
    const platformSegments: Array<{ x: number; y: number; width: number; height: number }> = [];
    const numSegments = Math.ceil(this.platformLength / this.segmentSize);
    
    for (let i = 0; i < numSegments; i++) {
      const z = -this.platformLength / 2 + i * this.segmentSize;
      platformSegments.push({
        x: -this.platformWidth / 2,
        y: 0, // Platform top at y=0.2, but we'll adjust in Three.js
        width: this.platformWidth,
        height: 0.2, // Platform thickness
      });
    }

    // Generate cave background using Phaser's noise/random utilities
    const wallSegments: Array<{ x: number; y: number; width: number; height: number }> = [];
    const ceilingSegments: Array<{ x: number; y: number; width: number; height: number }> = [];
    const floorSegments: Array<{ x: number; y: number; width: number; height: number }> = [];

    // Use random number generator for variation
    const random = this.rng;
    
    // Generate cave walls (left and right)
    const wallHeight = 20;
    const wallDepth = 1;
    const numWallSegments = 30;
    
    for (let i = 0; i < numWallSegments; i++) {
      const z = -this.platformLength / 2 + (i * this.platformLength) / numWallSegments;
      const variation = random.between(-0.2, 0.2); // Small variation
      
      // Left wall
      wallSegments.push({
        x: -this.platformWidth / 2 - 2.5 + variation,
        y: 5,
        width: wallDepth,
        height: wallHeight,
      });
      
      // Right wall
      wallSegments.push({
        x: this.platformWidth / 2 + 2.5 - variation,
        y: 5,
        width: wallDepth,
        height: wallHeight,
      });
    }

    // Generate ceiling segments
    const ceilingWidth = 50;
    const ceilingDepth = 1;
    const numCeilingSegments = 20;
    
    for (let i = 0; i < numCeilingSegments; i++) {
      const z = -this.platformLength / 2 + (i * this.platformLength) / numCeilingSegments;
      const variation = random.between(-0.1, 0.1);
      
      ceilingSegments.push({
        x: 0,
        y: 12 + variation,
        width: ceilingWidth,
        height: ceilingDepth,
      });
    }

    // Generate floor segments
    const floorWidth = 50;
    const floorDepth = 1;
    const numFloorSegments = 20;
    
    for (let i = 0; i < numFloorSegments; i++) {
      const z = -this.platformLength / 2 + (i * this.platformLength) / numFloorSegments;
      const variation = random.between(-0.1, 0.1);
      
      floorSegments.push({
        x: 0,
        y: -2 + variation,
        width: floorWidth,
        height: floorDepth,
      });
    }

    return {
      platform: {
        segments: platformSegments,
      },
      obstacles: [], // Can add obstacles later
      background: {
        walls: wallSegments,
        ceiling: ceilingSegments,
        floor: floorSegments,
      },
    };
  }

  // Generate pixelated cave texture data
  generateCaveTexture(width: number, height: number, tileSize: number = 2): number[][] {
    const random = this.rng;
    const texture: number[][] = [];
    
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);
    
    for (let y = 0; y < tilesY; y++) {
      texture[y] = [];
      for (let x = 0; x < tilesX; x++) {
        // Use Phaser's noise-like functions for cave pattern
        const noise = (Math.sin(x * 0.3) + Math.cos(y * 0.3) + random.between(-0.5, 0.5)) * 0.5 + 0.5;
        // Map to grey scale (0-1, where 0=black, 1=white)
        const greyValue = Math.max(0, Math.min(1, noise * 0.3 + 0.1)); // Mostly dark
        texture[y][x] = greyValue;
      }
    }
    
    return texture;
  }
}

