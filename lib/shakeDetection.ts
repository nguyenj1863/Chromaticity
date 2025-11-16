// Shake detection algorithm for controller movement

import { IMUData } from "./types";

interface ShakeDetectionState {
  accelerationHistory: number[][]; // History of acceleration vectors [x, y, z]
  maxHistorySize: number;
  isShaking: boolean;
  lastShakeTime: number;
}

export class ShakeDetector {
  private state: ShakeDetectionState;
  private readonly STILL_TOLERANCE = 0.2; // g-force tolerance for "still" (in g)
  private readonly SHAKE_THRESHOLD = 0.5; // Minimum acceleration magnitude to consider shaking (in g)
  private readonly SHAKE_VARIANCE_THRESHOLD = 0.15; // Variance threshold for shake detection
  private readonly WINDOW_SIZE = 10; // Number of samples to analyze
  private readonly SHAKE_COOLDOWN_MS = 200; // Minimum time between shake detections (ms) - increased
  private readonly CHANGE_THRESHOLD = 0.15; // Minimum change between samples to detect movement
  private readonly STILL_SAMPLES_REQUIRED = 5; // Number of consecutive "still" samples to confirm still
  private stillSampleCount = 0; // Track consecutive still samples

  constructor() {
    this.state = {
      accelerationHistory: [],
      maxHistorySize: this.WINDOW_SIZE,
      isShaking: false,
      lastShakeTime: 0,
    };
  }

  private normalizeAcceleration(accel?: IMUData["accel_g"]): [number, number, number] | null {
    if (!accel) {
      return null;
    }

    let normalized: number[] | null = null;
    if (Array.isArray(accel)) {
      normalized = accel.slice(0, 3);
    } else if (ArrayBuffer.isView(accel)) {
      normalized = Array.from(accel as ArrayLike<number>).slice(0, 3);
    } else if (typeof accel === "object" && accel !== null) {
      const anyAccel = accel as Record<number, unknown>;
      normalized = [anyAccel[0], anyAccel[1], anyAccel[2]].map((value) =>
        typeof value === "number" ? value : Number.NaN
      );
    }

    if (!normalized || normalized.length !== 3) {
      return null;
    }

    if (normalized.some((value) => typeof value !== "number" || Number.isNaN(value))) {
      return null;
    }

    return [normalized[0], normalized[1], normalized[2]];
  }

  /**
   * Detect if controller is being shaken based on acceleration patterns
   * @param imuData Current IMU data
   * @returns true if controller is being shaken, false if held still
   */
  detectShake(imuData: IMUData): boolean {
    const currentAccel = this.normalizeAcceleration(imuData.accel_g);
    if (!currentAccel) {
      // Push a neutral sample so history continues to age out old entries
      this.state.accelerationHistory.push([0, 0, 1]);
      if (this.state.accelerationHistory.length > this.state.maxHistorySize) {
        this.state.accelerationHistory.shift();
      }
      this.state.isShaking = false;
      this.stillSampleCount = Math.min(this.stillSampleCount + 1, this.STILL_SAMPLES_REQUIRED);
      return false;
    }
    
    // Add current acceleration to history
    this.state.accelerationHistory.push([...currentAccel]);
    
    // Keep only recent history
    if (this.state.accelerationHistory.length > this.state.maxHistorySize) {
      this.state.accelerationHistory.shift();
    }

    // Filter out gravity component
    // When still, the total magnitude should be ~1g (gravity)
    // We need to detect changes from this baseline, not absolute values
    const totalMagnitude = Math.sqrt(
      currentAccel[0] ** 2 + currentAccel[1] ** 2 + currentAccel[2] ** 2
    );
    
    // For horizontal movement detection, use only X-axis (left/right)
    // Z-axis often contains gravity component, so we'll detect changes instead
    const xAccel = currentAccel[0]; // Left/right movement
    
    // Calculate horizontal magnitude using X and filtered Z
    // Filter Z-axis: if it's close to 1g, it's likely just gravity
    const zFiltered = Math.abs(currentAccel[2] - 1.0); // Remove gravity component from Z
    const horizontalMagnitude = Math.sqrt(xAccel ** 2 + zFiltered ** 2);

    // Need at least a few samples to detect shaking reliably
    if (this.state.accelerationHistory.length < 5) {
      // For initial samples, check if values are changing
      if (this.state.accelerationHistory.length >= 3) {
        const hasChange = this.detectRapidAccelerationChanges();
        if (!hasChange && horizontalMagnitude < this.STILL_TOLERANCE) {
          this.stillSampleCount++;
          if (this.stillSampleCount >= 3) {
            return false;
          }
        }
      }
      return false; // Not enough data, assume still
    }

    // Calculate variance to check for stability
    const variance = this.calculateAccelerationVariance();
    
    // FIRST: Check if controller is still (priority check)
    // If horizontal magnitude is very low AND variance is low, it's definitely still
    if (horizontalMagnitude < this.STILL_TOLERANCE && variance < this.SHAKE_VARIANCE_THRESHOLD / 2) {
      this.stillSampleCount++;
      
      // Require multiple consecutive still samples to confirm
      if (this.stillSampleCount >= this.STILL_SAMPLES_REQUIRED) {
        this.state.isShaking = false;
        return false; // Definitely still, stop movement
      }
    } else {
      // Reset still counter if we detect any movement
      this.stillSampleCount = 0;
    }

    // If variance is very low AND horizontal magnitude is low, it's still
    if (variance < this.SHAKE_VARIANCE_THRESHOLD / 3 && horizontalMagnitude < this.STILL_TOLERANCE * 1.5) {
      this.state.isShaking = false;
      return false;
    }

    // Check if we're within cooldown period (prevent rapid toggling)
    const timeSinceLastShake = Date.now() - this.state.lastShakeTime;
    if (this.state.isShaking && timeSinceLastShake < this.SHAKE_COOLDOWN_MS) {
      // If we were shaking recently, check if we should continue
      // Only continue if we still have significant movement
      if (horizontalMagnitude < this.STILL_TOLERANCE && variance < this.SHAKE_VARIANCE_THRESHOLD / 2) {
        this.state.isShaking = false;
        return false; // Stop shaking during cooldown if now still
      }
      return true; // Continue shaking during cooldown
    }

    // PRIMARY METHOD: Detect changes over time (most reliable)
    // If values are changing significantly, it's shaking
    const rapidChange = this.detectRapidAccelerationChanges();
    const hasSignificantChange = this.detectSignificantChange(currentAccel);
    
    // Require BOTH change detection AND minimum magnitude
    if ((rapidChange || hasSignificantChange) && horizontalMagnitude > this.STILL_TOLERANCE) {
      // Additional check: variance must be above threshold
      if (variance > this.SHAKE_VARIANCE_THRESHOLD / 2) {
        this.state.isShaking = true;
        this.state.lastShakeTime = Date.now();
        this.stillSampleCount = 0;
        return true;
      }
    }

    // Method 2: Check if horizontal acceleration magnitude exceeds threshold
    // But only if variance also indicates movement
    if (horizontalMagnitude > this.SHAKE_THRESHOLD && variance > this.SHAKE_VARIANCE_THRESHOLD / 2) {
      this.state.isShaking = true;
      this.state.lastShakeTime = Date.now();
      this.stillSampleCount = 0;
      return true;
    }

    // If none of the shake conditions are met, it's still
    this.state.isShaking = false;
    return false;
  }

  /**
   * Calculate variance in acceleration magnitude over the history window
   */
  private calculateAccelerationVariance(): number {
    if (this.state.accelerationHistory.length < 3) return 0;

    // Calculate magnitudes for each sample (filtering gravity from Z)
    const magnitudes = this.state.accelerationHistory.map(accel => {
      const zFiltered = Math.abs(accel[2] - 1.0); // Remove gravity component
      const horizontal = Math.sqrt(accel[0] ** 2 + zFiltered ** 2);
      return horizontal;
    });

    // Calculate mean
    const mean = magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length;

    // Calculate variance
    const variance = magnitudes.reduce((sum, mag) => {
      return sum + (mag - mean) ** 2;
    }, 0) / magnitudes.length;

    return variance;
  }

  /**
   * Detect rapid changes in acceleration direction/magnitude
   */
  private detectRapidAccelerationChanges(): boolean {
    if (this.state.accelerationHistory.length < 3) return false;

    const history = this.state.accelerationHistory;
    let rapidChanges = 0;
    let totalChange = 0;

    // Check consecutive samples for large changes
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];

      // Calculate change in each axis
      const changeX = Math.abs(curr[0] - prev[0]);
      const changeY = Math.abs(curr[1] - prev[1]);
      const changeZ = Math.abs(curr[2] - prev[2]);
      
      // Calculate total change magnitude
      const changeMagnitude = Math.sqrt(changeX ** 2 + changeY ** 2 + changeZ ** 2);
      totalChange += changeMagnitude;

      // If change is significant, count it
      if (changeMagnitude > this.CHANGE_THRESHOLD) {
        rapidChanges++;
      }
    }

    // Average change per sample
    const avgChange = totalChange / (history.length - 1);

    // If average change is high OR many samples show rapid changes, it's shaking
    return avgChange > this.CHANGE_THRESHOLD * 1.5 || rapidChanges > history.length / 3;
  }

  /**
   * Detect significant changes compared to recent average
   */
  private detectSignificantChange(currentAccel: number[]): boolean {
    if (this.state.accelerationHistory.length < 3) return false;

    const history = this.state.accelerationHistory;
    
    // Calculate average of recent history (excluding current)
    const recentHistory = history.slice(0, -1);
    const avgX = recentHistory.reduce((sum, accel) => sum + accel[0], 0) / recentHistory.length;
    const avgY = recentHistory.reduce((sum, accel) => sum + accel[1], 0) / recentHistory.length;
    const avgZ = recentHistory.reduce((sum, accel) => sum + accel[2], 0) / recentHistory.length;

    // Calculate difference from average
    // For Z-axis, compare the deviation from 1g (gravity)
    const diffX = Math.abs(currentAccel[0] - avgX);
    const diffY = Math.abs(currentAccel[1] - avgY);
    const diffZFromGravity = Math.abs((currentAccel[2] - 1.0) - (avgZ - 1.0)); // Compare deviation from gravity
    
    // Focus on X and Y changes (Z often has gravity component)
    const horizontalDiff = Math.sqrt(diffX ** 2 + diffZFromGravity ** 2);
    const totalDiff = Math.sqrt(diffX ** 2 + diffY ** 2 + diffZFromGravity ** 2);

    // If current value differs significantly from recent average, it's shaking
    // Require significant change in horizontal plane
    return horizontalDiff > this.CHANGE_THRESHOLD || totalDiff > this.CHANGE_THRESHOLD * 1.5;
  }

  /**
   * Check if controller is held still (within tolerance)
   */
  isStill(imuData: IMUData): boolean {
    const accel = this.normalizeAcceleration(imuData.accel_g);
    if (!accel) {
      return true;
    }
    // Filter gravity from Z-axis
    const zFiltered = Math.abs(accel[2] - 1.0);
    const horizontalMagnitude = Math.sqrt(accel[0] ** 2 + zFiltered ** 2);
    return horizontalMagnitude < this.STILL_TOLERANCE;
  }

  /**
   * Get forward acceleration (Z-axis) for forward movement
   * Only returns positive values (forward) when shaking is detected
   */
  getForwardMovement(imuData: IMUData, isShaking: boolean): number {
    if (!isShaking) {
      return 0; // No movement if not shaking
    }

    // Only use Z-axis (forward/backward)
    const accel = this.normalizeAcceleration(imuData.accel_g);
    if (!accel) {
      return 0;
    }
    const forwardAccel = accel[2]; // Z-axis

    // Only allow forward movement (positive Z)
    // Filter out backward movement and small noise
    if (forwardAccel > this.STILL_TOLERANCE) {
      return forwardAccel;
    }

    return 0;
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.state.accelerationHistory = [];
    this.state.isShaking = false;
    this.state.lastShakeTime = 0;
    this.stillSampleCount = 0;
  }
}

