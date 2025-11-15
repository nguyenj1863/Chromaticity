// Simple physics engine for collision detection and response
import * as THREE from "three";

// Axis-Aligned Bounding Box (AABB) for collision detection
export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

// Collision object definition
export interface CollisionObject {
  aabb: AABB;
  type: "platform" | "wall" | "obstacle";
}

// Calculate AABB for a box geometry at a given position
// position is the center of the bounding box
export function createAABB(
  position: THREE.Vector3,
  size: THREE.Vector3,
  offset?: THREE.Vector3 // Optional offset from position to actual center
): AABB {
  // For axis-aligned boxes, we can use the size directly
  const halfSize = size.clone().multiplyScalar(0.5);
  const center = offset ? position.clone().add(offset) : position.clone();
  
  return {
    min: center.clone().sub(halfSize),
    max: center.clone().add(halfSize),
  };
}

// Check if two AABBs intersect
export function aabbIntersect(a: AABB, b: AABB): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}

// Calculate the minimum translation vector to resolve collision
export function getCollisionMTV(characterAABB: AABB, objectAABB: AABB): THREE.Vector3 {
  const mtv = new THREE.Vector3();
  
  // Calculate overlap on each axis
  const overlapX = Math.min(
    characterAABB.max.x - objectAABB.min.x,
    objectAABB.max.x - characterAABB.min.x
  );
  const overlapY = Math.min(
    characterAABB.max.y - objectAABB.min.y,
    objectAABB.max.y - characterAABB.min.y
  );
  const overlapZ = Math.min(
    characterAABB.max.z - objectAABB.min.z,
    objectAABB.max.z - characterAABB.min.z
  );
  
  // Find the axis with minimum overlap (smallest penetration)
  const minOverlap = Math.min(overlapX, overlapY, overlapZ);
  
  if (minOverlap === overlapX) {
    // Resolve on X axis
    const direction = characterAABB.min.x < objectAABB.min.x ? -1 : 1;
    mtv.x = overlapX * direction;
  } else if (minOverlap === overlapY) {
    // Resolve on Y axis
    const direction = characterAABB.min.y < objectAABB.min.y ? -1 : 1;
    mtv.y = overlapY * direction;
  } else {
    // Resolve on Z axis
    const direction = characterAABB.min.z < objectAABB.min.z ? -1 : 1;
    mtv.z = overlapZ * direction;
  }
  
  return mtv;
}

// Physics engine class
export class PhysicsEngine {
  private collisionObjects: CollisionObject[] = [];
  private platformObject: CollisionObject | null = null;
  private staticObjects: CollisionObject[] = []; // Walls, obstacles (non-platform)
  
  // Register a collision object
  addCollisionObject(object: CollisionObject) {
    this.collisionObjects.push(object);
    if (object.type === "platform") {
      this.platformObject = object;
    } else {
      this.staticObjects.push(object);
    }
  }
  
  // Remove all collision objects
  clearCollisionObjects() {
    this.collisionObjects = [];
    this.platformObject = null;
    this.staticObjects = [];
  }
  
  // Fast distance check to skip far objects
  private isNearby(characterAABB: AABB, objectAABB: AABB, margin: number = 2.0): boolean {
    // Check if objects are within margin distance
    const charCenter = new THREE.Vector3(
      (characterAABB.min.x + characterAABB.max.x) * 0.5,
      (characterAABB.min.y + characterAABB.max.y) * 0.5,
      (characterAABB.min.z + characterAABB.max.z) * 0.5
    );
    const objCenter = new THREE.Vector3(
      (objectAABB.min.x + objectAABB.max.x) * 0.5,
      (objectAABB.min.y + objectAABB.max.y) * 0.5,
      (objectAABB.min.z + objectAABB.max.z) * 0.5
    );
    
    const distance = charCenter.distanceTo(objCenter);
    const maxSize = Math.max(
      characterAABB.max.x - characterAABB.min.x,
      characterAABB.max.y - characterAABB.min.y,
      characterAABB.max.z - characterAABB.min.z
    );
    
    return distance < maxSize + margin;
  }
  
  // Check collision and resolve (optimized)
  checkAndResolveCollision(
    characterPosition: THREE.Vector3,
    characterSize: THREE.Vector3,
    characterCenterOffset?: THREE.Vector3
  ): THREE.Vector3 {
    // Cache character AABB calculation
    const characterAABB = createAABB(characterPosition, characterSize, characterCenterOffset);
    let resolvedPosition = characterPosition.clone();
    let needsRecheck = false;
    
    // First, check platform collision (most common, separate for optimization)
    if (this.platformObject) {
      // Quick bounds check before expensive intersection test
      if (
        characterAABB.max.x >= this.platformObject.aabb.min.x &&
        characterAABB.min.x <= this.platformObject.aabb.max.x &&
        characterAABB.max.z >= this.platformObject.aabb.min.z &&
        characterAABB.min.z <= this.platformObject.aabb.max.z
      ) {
        if (aabbIntersect(characterAABB, this.platformObject.aabb)) {
          const mtv = getCollisionMTV(characterAABB, this.platformObject.aabb);
          // Push character out of platform
          // If character is below platform (mtv.y > 0), push up
          // If character is above but intersecting (mtv.y < 0), still resolve but prefer upward
          if (mtv.y > 0) {
            // Character is below/inside platform - push up
            resolvedPosition.y += mtv.y;
            needsRecheck = true;
          } else if (characterAABB.min.y < this.platformObject.aabb.max.y) {
            // Character is intersecting from above (during jump descent) - push up to platform top
            const pushUp = this.platformObject.aabb.max.y - characterAABB.min.y;
            resolvedPosition.y += pushUp;
            needsRecheck = true;
          }
        }
      }
    }
    
    // Check static objects (walls, obstacles) - only check nearby ones
    for (const obj of this.staticObjects) {
      // Early exit: skip if not nearby
      if (!this.isNearby(characterAABB, obj.aabb, 1.0)) {
        continue;
      }
      
      // Quick bounds check
      if (
        characterAABB.max.x < obj.aabb.min.x ||
        characterAABB.min.x > obj.aabb.max.x ||
        characterAABB.max.y < obj.aabb.min.y ||
        characterAABB.min.y > obj.aabb.max.y ||
        characterAABB.max.z < obj.aabb.min.z ||
        characterAABB.min.z > obj.aabb.max.z
      ) {
        continue; // No intersection possible
      }
      
      if (aabbIntersect(characterAABB, obj.aabb)) {
        const mtv = getCollisionMTV(characterAABB, obj.aabb);
        resolvedPosition.add(mtv);
        needsRecheck = true;
      }
    }
    
    // Only recalculate if position changed
    if (needsRecheck) {
      const newAABB = createAABB(resolvedPosition, characterSize, characterCenterOffset);
      
      // Quick second pass only for objects that might still intersect
      if (this.platformObject && aabbIntersect(newAABB, this.platformObject.aabb)) {
        const secondMTV = getCollisionMTV(newAABB, this.platformObject.aabb);
        if (secondMTV.y > 0) {
          resolvedPosition.y += secondMTV.y;
        }
      }
      
      // Check static objects again only if nearby
      for (const obj of this.staticObjects) {
        if (this.isNearby(newAABB, obj.aabb, 1.0) && aabbIntersect(newAABB, obj.aabb)) {
          const secondMTV = getCollisionMTV(newAABB, obj.aabb);
          resolvedPosition.add(secondMTV);
        }
      }
    }
    
    return resolvedPosition;
  }
  
  // Check if a position would cause a collision (without resolving) - optimized
  wouldCollide(
    characterPosition: THREE.Vector3,
    characterSize: THREE.Vector3,
    characterCenterOffset?: THREE.Vector3
  ): boolean {
    const characterAABB = createAABB(characterPosition, characterSize, characterCenterOffset);
    
    // Only check static objects (walls/obstacles), skip platform
    for (const obj of this.staticObjects) {
      // Early exit: skip if not nearby
      if (!this.isNearby(characterAABB, obj.aabb, 1.0)) {
        continue;
      }
      
      if (aabbIntersect(characterAABB, obj.aabb)) {
        return true;
      }
    }
    
    return false;
  }
  
  // Get the top surface of the platform at a given X, Z position (optimized)
  getPlatformHeight(x: number, z: number): number {
    if (this.platformObject) {
      // Quick bounds check
      if (
        x >= this.platformObject.aabb.min.x &&
        x <= this.platformObject.aabb.max.x &&
        z >= this.platformObject.aabb.min.z &&
        z <= this.platformObject.aabb.max.z
      ) {
        return this.platformObject.aabb.max.y; // Top of platform
      }
    }
    return 0; // Default to ground level
  }
}

