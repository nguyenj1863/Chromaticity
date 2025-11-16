"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/app/store/useStore";
import { detectPose, initializeMoveNet } from "@/lib/tensorflow";
import * as poseDetection from "@tensorflow-models/pose-detection";
import GameScene from "./GameScene";
import { IMUData } from "@/lib/types";
import { setupIMUNotifications } from "@/lib/controllerBLE";

type PoseState = "standing" | "jumping" | "unknown";

interface SoloGameProps {
  onClose?: () => void;
}

export default function SoloGame({ onClose }: SoloGameProps) {
  const { selectedCameraDeviceId, setSelectedCameraDeviceId, cameraStream: existingStream, setCameraStream, controllerConnection } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [poseState, setPoseState] = useState<PoseState>("unknown");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing TensorFlow...");
  const [error, setError] = useState<string | null>(null);
  const [imuData, setImuData] = useState<IMUData | null>(null);
  const [levelReady, setLevelReady] = useState(false);
  const levelReadyRef = useRef(false);
  const [stepProgress, setStepProgress] = useState<{ [key: number]: number }>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const animationFrameRef = useRef<number | null>(null);
  const previousYPositionRef = useRef<number | null>(null);
  const velocityRef = useRef<number>(0);
  // Jump detection refs - track jump cycle (up then down)
  const jumpPeakYRef = useRef<number | null>(null); // Highest point reached during jump
  const jumpStateRef = useRef<"none" | "going_up" | "at_peak" | "coming_down">("none");
  const jumpFramesRef = useRef<number>(0); // Track how long we've been in jump state
  // Calibration refs for baseline pose detection
  const baselineHipShoulderRatioRef = useRef<number | null>(null);
  const baselineBodyHeightRef = useRef<number | null>(null);
  const calibrationFramesRef = useRef<number>(0);
  const isCalibratedRef = useRef<boolean>(false);
  const initRef = useRef(false); // Prevent multiple initializations
  const streamUsedRef = useRef(false); // Track if we've used the existing stream
  const streamRef = useRef<MediaStream | null>(null); // Keep reference to stream
  const isMountedRef = useRef(true); // Use ref for mounting state to avoid strict mode issues
  const isInitializedRef = useRef(false); // Track initialization state in ref for cleanup

  // Capture the existing stream immediately when component mounts
  useEffect(() => {
    if (existingStream && existingStream.active && !streamRef.current) {
      streamRef.current = existingStream;
    }
  }, []); // Only run once on mount

  // Transfer stream to visible video element when switching from loading to game view
  useEffect(() => {
    if (!isLoading && isInitialized && streamRef.current) {
      // Wait a bit for the visible video element to be rendered
      const transferStream = () => {
        if (videoRef.current && streamRef.current) {
          // Check if the visible video element doesn't have the stream yet
          if (videoRef.current.srcObject !== streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(err => {
              console.error("Error playing video after transfer:", err);
            });
          }
        }
      };
      
      // Try immediately, then retry after a short delay if needed
      transferStream();
      setTimeout(() => transferStream(), 100);
      setTimeout(() => transferStream(), 300);
    }
  }, [isLoading, isInitialized]);

  // Initialize camera and TensorFlow
  useEffect(() => {
    // Prevent multiple initializations - check at the start
    if (initRef.current) {
      return;
    }
    initRef.current = true;
    isMountedRef.current = true; // Set mounted flag
    
    let mountedStream: MediaStream | null = null;
    
    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Step 1: Initialize MoveNet
        setCurrentStep(1);
        setStepProgress({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
        setLoadingMessage("Step 1/5: Loading TensorFlow MoveNet...");
        setStepProgress(prev => ({ ...prev, 1: 20 }));
        
        try {
          setStepProgress(prev => ({ ...prev, 1: 50 }));
          await initializeMoveNet();
          setStepProgress(prev => ({ ...prev, 1: 100 }));
        } catch (tfError: any) {
          console.error("TensorFlow initialization error:", tfError);
          throw new Error(`TensorFlow error: ${tfError.message || "Failed to load MoveNet model"}`);
        }
        
        // Step 2: Check camera availability
        setCurrentStep(2);
        setStepProgress(prev => ({ ...prev, 2: 0 }));
        setLoadingMessage("Step 2/5: Checking camera availability...");
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not available. Please use a modern browser with camera support.");
        }
        
        setStepProgress(prev => ({ ...prev, 2: 30 }));
        const devices = await navigator.mediaDevices.enumerateDevices();
        setStepProgress(prev => ({ ...prev, 2: 60 }));
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          throw new Error("No camera devices found. Please connect a camera and try again.");
        }
        
        setStepProgress(prev => ({ ...prev, 2: 80 }));
        // Check if the selected device ID is still valid
        if (selectedCameraDeviceId) {
          const deviceExists = videoDevices.some(device => device.deviceId === selectedCameraDeviceId);
          if (!deviceExists) {
            setSelectedCameraDeviceId(null);
          }
        }
        setStepProgress(prev => ({ ...prev, 2: 100 }));
        
        // Step 3: Use existing camera stream or request new one
        setCurrentStep(3);
        setStepProgress(prev => ({ ...prev, 3: 0 }));
        setLoadingMessage("Step 3/5: Setting up camera...");
        
        let stream: MediaStream;
        
        // Use the stream from ref (captured on mount) or from store
        const streamToUse = streamRef.current || existingStream;
        
        if (streamToUse && streamToUse.active && !streamUsedRef.current) {
          setStepProgress(prev => ({ ...prev, 3: 50 }));
          stream = streamToUse;
          streamRef.current = streamToUse; // Ensure it's in ref
          streamUsedRef.current = true; // Mark that we've used the stream
          setStepProgress(prev => ({ ...prev, 3: 100 }));
        } else if (streamUsedRef.current && streamRef.current && streamRef.current.active) {
          setStepProgress(prev => ({ ...prev, 3: 50 }));
          // Stream was already used, reuse our stored reference
          stream = streamRef.current;
          setStepProgress(prev => ({ ...prev, 3: 100 }));
        } else {
          // Request new camera access
          setLoadingMessage("Step 3/5: Requesting camera access...");
          setStepProgress(prev => ({ ...prev, 3: 20 }));
          
          // Use the selected camera device ID if available, otherwise use default
          const videoConstraints: MediaTrackConstraints = {
            width: { ideal: 640 },
            height: { ideal: 480 },
          };
          
          if (selectedCameraDeviceId) {
            videoConstraints.deviceId = { exact: selectedCameraDeviceId };
          } else {
            videoConstraints.facingMode = "user";
          }
          
          try {
            setStepProgress(prev => ({ ...prev, 3: 40 }));
            stream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
            });
            setStepProgress(prev => ({ ...prev, 3: 80 }));
          } catch (cameraError: any) {
            console.error("Camera access error:", cameraError);
            
            // If exact device ID failed, try with ideal instead
            if (selectedCameraDeviceId && cameraError.name === 'OverconstrainedError') {
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    deviceId: { ideal: selectedCameraDeviceId },
                  },
                });
              } catch (fallbackError: any) {
                console.error("Fallback camera access also failed:", fallbackError);
                // Try without device ID constraint
                stream = await navigator.mediaDevices.getUserMedia({
                  video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user",
                  },
                });
              }
            } else {
              // For other errors, provide a more helpful message
              let errorMessage = "Camera access failed. ";
              if (cameraError.name === 'NotAllowedError') {
                errorMessage += "Please grant camera permissions in your browser settings.";
              } else if (cameraError.name === 'NotFoundError') {
                errorMessage += "No camera found. Please connect a camera and try again.";
              } else if (cameraError.name === 'NotReadableError') {
                errorMessage += "Camera is in use by another application. Please close other apps using the camera.";
              } else {
                errorMessage += cameraError.message || "Unknown error occurred.";
              }
              throw new Error(errorMessage);
            }
          }
        }
        
        if (!stream.active) {
          throw new Error("Camera stream is no longer active. It may have been disconnected.");
        }

        // Wait for video element to be available
        let attempts = 0;
        const maxAttempts = 20;
        while (!videoRef.current && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!videoRef.current) {
          throw new Error("Video element not found. Please refresh the page.");
        }

        setLoadingMessage("Step 4/5: Starting video stream...");
        
        if (!stream.active) {
          throw new Error("Camera stream is no longer active. It may have been disconnected.");
        }
        
        setStepProgress(prev => ({ ...prev, 4: 20 }));
        videoRef.current.srcObject = stream;
        streamRef.current = stream; // Store in ref for later use
        mountedStream = stream;
        
        try {
          setStepProgress(prev => ({ ...prev, 4: 40 }));
          await videoRef.current.play();
          setStepProgress(prev => ({ ...prev, 4: 60 }));
        } catch (playError: any) {
          console.error("Error playing video:", playError);
          throw playError;
        }
        
        // Wait for video to be ready with timeout
        setLoadingMessage("Step 4/5: Waiting for video to be ready...");
        
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error("Video element not available"));
            return;
          }
          
          const timeout = setTimeout(() => {
            reject(new Error("Video failed to load. Please check your camera."));
          }, 5000);
          
          const onLoaded = () => {
            clearTimeout(timeout);
            setStepProgress(prev => ({ ...prev, 4: 100 }));
            resolve(undefined);
          };
          
          if (videoRef.current.readyState >= 2) {
            clearTimeout(timeout);
            setStepProgress(prev => ({ ...prev, 4: 100 }));
            resolve(undefined);
          } else {
            const progressInterval = setInterval(() => {
              if (videoRef.current && videoRef.current.readyState >= 1) {
                setStepProgress(prev => ({ ...prev, 4: Math.min(90, (prev[4] || 0) + 5) }));
              }
            }, 200);
            
            videoRef.current.onloadedmetadata = () => {
              clearInterval(progressInterval);
              onLoaded();
            };
            videoRef.current.onerror = () => {
              clearInterval(progressInterval);
              clearTimeout(timeout);
              reject(new Error("Video element error"));
            };
          }
        });
        
        // Step 5: Load game level/map
        setCurrentStep(5);
        setStepProgress(prev => ({ ...prev, 5: 0 }));
        setLoadingMessage("Step 5/5: Loading game map...");
        
        // Reset level ready flag
        levelReadyRef.current = false;
        setLevelReady(false);
        
        // Generate level data early (this is fast, but we'll wait for rendering)
        setStepProgress(prev => ({ ...prev, 5: 20 }));
        const { LevelGenerator } = await import("@/lib/levelGenerator");
        setStepProgress(prev => ({ ...prev, 5: 40 }));
        const generator = new LevelGenerator();
        const levelData = generator.generateLevel();
        setStepProgress(prev => ({ ...prev, 5: 60 }));
        
        // Wait a bit for the level to render (give React time to mount and render)
        await new Promise((resolve) => setTimeout(resolve, 500));
        setStepProgress(prev => ({ ...prev, 5: 70 }));
        
        // Wait for level ready callback (with timeout)
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Map loading timeout. Please refresh the page."));
          }, 10000); // 10 second timeout for map loading
          
          // Check if level is ready, poll every 100ms and update progress
          const checkLevel = setInterval(() => {
            // Use ref to check current value (avoids closure issue)
            if (levelReadyRef.current) {
              clearInterval(checkLevel);
              clearTimeout(timeout);
              setStepProgress(prev => ({ ...prev, 5: 100 }));
              resolve(undefined);
            } else {
              // Gradually increase progress while waiting
              setStepProgress(prev => ({ 
                ...prev, 
                5: Math.min(95, (prev[5] || 70) + 1) 
              }));
            }
          }, 100);
        });
        
        setLoadingMessage("Starting pose detection...");
        
        // CRITICAL: Set isInitializedRef BEFORE the delay to prevent cleanup from stopping stream
        isInitializedRef.current = true;
        
        // Small delay to ensure everything is ready
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        // Don't check isMountedRef here - if cleanup ran, isInitializedRef should protect us
        if (!isMountedRef.current && !isInitializedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        
        setIsInitialized(true);
        
        // Set isLoading to false AFTER ensuring stream is in streamRef
        setIsLoading(false);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        
        console.error("Error initializing:", err);
        const errorMessage = err.message || "Failed to initialize camera or TensorFlow";
        setError(errorMessage);
        setIsLoading(false);
        
        // Stop any streams that might have been started
        if (mountedStream) {
          mountedStream.getTracks().forEach((track) => track.stop());
          mountedStream = null;
        }
      }
    };

    init();

    return () => {
      // Only cleanup if component is actually unmounting (not just re-rendering)
      // Check if initialization is complete - if so, don't stop the stream
      if (isInitializedRef.current) {
        // Don't stop the stream if we're initialized - it's still in use
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        // Don't stop mountedStream or videoRef stream - they're still needed
        return;
      }
      
      // Only cleanup if initialization didn't complete
      isMountedRef.current = false; // Set mounted flag to false on cleanup
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mountedStream) {
        mountedStream.getTracks().forEach((track) => track.stop());
        mountedStream = null;
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - don't depend on stream or device ID

  // Detect pose and determine state
  // HOW IT WORKS:
  // 1. CALIBRATION: When player first appears, we establish a baseline "normal standing" pose
  //    - Collects 30 frames of data to establish baseline hip-shoulder ratio
  //    - This baseline adapts to the player's natural standing position
  //    - Works regardless of initial distance from camera
  //
  // 2. JUMPING: Detects rapid upward movement relative to baseline
  //    - Tracks hip position changes over time
  //    - Uses relative movement (percentage of current body height)
  //    - Requires significant upward velocity (4% of body height per frame)
  //    - Must complete full cycle: up then down
  //
  // 3. STANDING: Default state when pose matches baseline (within tolerance)
  const detectPoseState = (poses: poseDetection.Pose[]): PoseState => {
    if (poses.length === 0) return "standing";

    const pose = poses[0];
    const keypoints = pose.keypoints;

    // Get key points we need (filter by confidence)
    const getKeypoint = (name: string) => {
      const kp = keypoints.find((kp) => kp.name === name);
      return kp && kp.score && kp.score > 0.3 ? kp : null;
    };

    const nose = getKeypoint("nose");
    const leftShoulder = getKeypoint("left_shoulder");
    const rightShoulder = getKeypoint("right_shoulder");
    const leftHip = getKeypoint("left_hip");
    const rightHip = getKeypoint("right_hip");
    const leftKnee = getKeypoint("left_knee");
    const rightKnee = getKeypoint("right_knee");
    const leftAnkle = getKeypoint("left_ankle");
    const rightAnkle = getKeypoint("right_ankle");

    // Check if we have enough keypoints
    if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return "standing";
    }

    // Calculate average positions
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const headY = nose.y;

    // Calculate body height (head to hip)
    const bodyHeight = Math.abs(headY - hipY);
    if (bodyHeight < 30) return "standing"; // Too small, likely detection error

    // Calculate current hip-shoulder ratio
    const hipShoulderDiff = hipY - shoulderY;
    const hipShoulderRatio = hipShoulderDiff / bodyHeight;

    // CALIBRATION PHASE: Establish baseline when player first appears
    if (!isCalibratedRef.current) {
      calibrationFramesRef.current++;
      
      // Collect baseline data over 30 frames (about 1 second at 30fps)
      if (calibrationFramesRef.current <= 30) {
        // Accumulate baseline ratio
        if (baselineHipShoulderRatioRef.current === null) {
          baselineHipShoulderRatioRef.current = hipShoulderRatio;
        } else {
          // Average the ratios for a stable baseline
          baselineHipShoulderRatioRef.current = 
            (baselineHipShoulderRatioRef.current * (calibrationFramesRef.current - 1) + hipShoulderRatio) / 
            calibrationFramesRef.current;
        }
        baselineBodyHeightRef.current = bodyHeight;
        // During calibration, default to standing
        return "standing";
      } else {
        // Calibration complete
        isCalibratedRef.current = true;
      }
    }

    // After calibration, use baseline for detection
    const baselineRatio = baselineHipShoulderRatioRef.current || 0.35;
    const baselineBodyHeight = baselineBodyHeightRef.current || bodyHeight;
    const currentHipY = hipY;

    // JUMPING DETECTION: Track complete jump cycle (standing → up → down → standing)
    // Player must: 1) Start from standing, 2) Move upward, 3) Come back down
    const previousHipY = previousYPositionRef.current;
    
    if (previousHipY !== null) {
      const deltaY = currentHipY - previousHipY;
      // Convert to percentage of current body height (works at any distance)
      const deltaYPercent = (deltaY / bodyHeight) * 100;
      
      // Smooth velocity with exponential moving average
      velocityRef.current = deltaYPercent * 0.3 + velocityRef.current * 0.7;
      
      // Jump state machine
      if (jumpStateRef.current === "none") {
        // Not jumping - must start from standing position
        // Check if starting to jump: significant upward movement from standing
        // Require strong signal: velocity < -4 (upward) AND displacement > 3% body height
        if (velocityRef.current < -4 && currentHipY < previousHipY - (bodyHeight * 0.03)) {
          // Additional check: make sure we're not just moving backward
          // If body height is also increasing (player moving away), it's likely movement, not jump
          const bodyHeightChange = bodyHeight - baselineBodyHeight;
          const bodyHeightIncrease = bodyHeightChange / baselineBodyHeight;
          
          // Only start jump if:
          // 1. Body isn't significantly larger (not moving away from camera)
          // 2. We have sustained upward movement (not just noise)
          if (bodyHeightIncrease < 0.1 && Math.abs(velocityRef.current) > 4) {
            jumpStateRef.current = "going_up";
            jumpPeakYRef.current = currentHipY;
            jumpFramesRef.current = 0;
          }
        }
      } else if (jumpStateRef.current === "going_up") {
        jumpFramesRef.current++;
        
        // Currently going up - track the peak (highest point)
        if (currentHipY < jumpPeakYRef.current!) {
          // Still going up, update peak
          jumpPeakYRef.current = currentHipY;
          jumpFramesRef.current = 0; // Reset counter when still ascending
          return "jumping";
        } else if (currentHipY >= jumpPeakYRef.current! + (bodyHeight * 0.015)) {
          // Started coming down (at least 1.5% of body height down from peak)
          // This confirms we reached the peak and are now descending
          jumpStateRef.current = "coming_down";
          jumpFramesRef.current = 0;
          return "jumping";
        } else {
          // At peak or stopped ascending
          // If we've been at peak for more than 20 frames (~0.67 seconds) without descending,
          // it's likely a false positive (player moved backward and stopped, or just standing)
          if (jumpFramesRef.current > 20) {
            // False positive - reset to standing
            jumpStateRef.current = "none";
            jumpPeakYRef.current = null;
            jumpFramesRef.current = 0;
          } else {
            // Still at peak, might be real jump - return jumping
            return "jumping";
          }
        }
      } else if (jumpStateRef.current === "coming_down") {
        // Coming down after peak - this confirms it was a real jump
        // Must complete the downward movement to finish the jump cycle
        if (currentHipY >= previousHipY + (bodyHeight * 0.01)) {
          // Still going down - continue jumping state
          return "jumping";
        } else {
          // Landed or stopped descending - back to standing
          // Reset jump state to allow new jump detection
          jumpStateRef.current = "none";
          jumpPeakYRef.current = null;
          jumpFramesRef.current = 0;
          // Return standing - jump cycle complete
        }
      }
    }
    
    previousYPositionRef.current = currentHipY;

    // Default to standing if not jumping
    return "standing";
  };

  // Main pose detection loop
  useEffect(() => {
    if (!isInitialized || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const detect = async () => {
      // Check stream state periodically
      const currentStream = video.srcObject as MediaStream | null;
      if (currentStream) {
        const isActive = currentStream.active;
        const tracks = currentStream.getTracks();
        const activeTracks = tracks.filter(t => t.readyState === 'live');
        
        if (!isActive || activeTracks.length === 0) {
          console.error("Stream became inactive during pose detection");
        }
      }
      
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Set canvas internal size to match video's native dimensions
        // This ensures keypoint coordinates align correctly
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // Detect poses
        const poses = await detectPose(video);
        
        // Determine pose state
        const state = detectPoseState(poses);
        setPoseState(state);

        // Draw pose skeleton and keypoints
        if (poses.length > 0) {
          const pose = poses[0];
          const keypoints = pose.keypoints;
          
          // Helper to get keypoint by name
          const getKeypoint = (name: string) => {
            return keypoints.find((kp) => kp.name === name);
          };
          
          // Helper to check if keypoint is valid
          const isValid = (kp: poseDetection.Keypoint | undefined) => {
            return kp && kp.score && kp.score > 0.3;
          };
          
          // Define skeleton connections (MoveNet 17 keypoints)
          const connections = [
            // Head
            ["nose", "left_eye"],
            ["nose", "right_eye"],
            ["left_eye", "left_ear"],
            ["right_eye", "right_ear"],
            // Torso
            ["left_shoulder", "right_shoulder"],
            ["left_shoulder", "left_hip"],
            ["right_shoulder", "right_hip"],
            ["left_hip", "right_hip"],
            // Left arm
            ["left_shoulder", "left_elbow"],
            ["left_elbow", "left_wrist"],
            // Right arm
            ["right_shoulder", "right_elbow"],
            ["right_elbow", "right_wrist"],
            // Left leg
            ["left_hip", "left_knee"],
            ["left_knee", "left_ankle"],
            // Right leg
            ["right_hip", "right_knee"],
            ["right_knee", "right_ankle"],
          ] as const;
          
          // Clear canvas first (don't draw video, just overlay)
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw skeleton lines
          ctx.strokeStyle = "#00ff00";
          ctx.lineWidth = 2;
          connections.forEach(([startName, endName]) => {
            const start = getKeypoint(startName);
            const end = getKeypoint(endName);
            
            if (isValid(start) && isValid(end)) {
              ctx.beginPath();
              ctx.moveTo(start!.x, start!.y);
              ctx.lineTo(end!.x, end!.y);
              ctx.stroke();
            }
          });
          
          // Draw keypoints
          keypoints.forEach((keypoint) => {
            if (isValid(keypoint)) {
              // Draw outer circle (glow effect)
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 8, 0, 2 * Math.PI);
              ctx.fillStyle = "rgba(0, 255, 0, 0.3)";
              ctx.fill();
              
              // Draw inner circle
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = "#00ff00";
              ctx.fill();
              
              // Draw border
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          });
        }
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    };
    
    detect();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized]);
  
  // Monitor stream state changes
  useEffect(() => {
    if (!videoRef.current?.srcObject) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    
    const checkStream = () => {
      if (!stream.active) {
        console.error("Stream became inactive");
      }
    };
    
    // Check stream state every second
    const interval = setInterval(checkStream, 1000);
    
    // Also listen to track ended events
    stream.getTracks().forEach(track => {
      track.onended = () => {
        console.error(`Track ended: ${track.kind} (${track.label})`);
      };
    });
    
    return () => {
      clearInterval(interval);
    };
  }, [isLoading, isInitialized]);

  // Set up real controller IMU data reception when game is ready
  useEffect(() => {
    if (isInitialized && !isLoading && controllerConnection) {
      let characteristic: any = null;
      let notificationInterval: NodeJS.Timeout | null = null;
      
      const setupController = async () => {
        try {
          // Verify server is still connected
          if (!controllerConnection.server?.connected) {
            console.error("GATT server is not connected!");
            return;
          }
          
          // Always set up notifications fresh to ensure listener is active
          characteristic = await setupIMUNotifications(
            controllerConnection.server,
            (data) => {
              setImuData(data);
            }
          );
          
          if (characteristic) {
            // Update store with characteristic
            useStore.getState().setControllerConnection({
              ...controllerConnection,
              characteristic,
            });
          }
          
          // Set up periodic check to verify connection is alive
          if (characteristic) {
            notificationInterval = setInterval(() => {
              if (!controllerConnection.server?.connected) {
                console.error("GATT server disconnected!");
                clearInterval(notificationInterval!);
              }
            }, 5000); // Check every 5 seconds
          }
        } catch (error) {
          console.error("Error setting up controller IMU:", error);
        }
      };
      
      setupController();
      
      return () => {
        // Cleanup: stop notifications and interval
        if (notificationInterval) {
          clearInterval(notificationInterval);
        }
        if (characteristic) {
          characteristic.stopNotifications().catch(console.error);
        }
      };
    }
  }, [isInitialized, isLoading, controllerConnection]);

  // Loading screen - but render video element and game scene in background so they're available for initialization
  if (isLoading) {
    return (
      <>
        {/* Hidden video element for initialization */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        
        {/* Render game scene in background (off-screen) so level can generate */}
        <div className="absolute -left-[9999px] -top-[9999px] w-1 h-1 overflow-hidden">
          <GameScene poseState={poseState} imuData={imuData} onLevelReady={() => {
            levelReadyRef.current = true;
            setLevelReady(true);
          }} />
        </div>
        
        {/* Loading screen */}
        <div className="min-h-screen bg-black flex items-center justify-center relative z-50">
          <div className="text-center">
            <div className="mb-8 flex justify-center">
              {/* Pixelated spinner */}
              <div className="pixel-spinner">
                {[...Array(8)].map((_, i) => {
                  const angle = (i * 45);
                  return (
                    <div
                      key={i}
                      className="pixel-spinner-dot"
                      style={{
                        '--start-rot': `${angle}deg`,
                        '--end-rot': `-${angle}deg`,
                      } as React.CSSProperties}
                    />
                  );
                })}
              </div>
            </div>
            <h2
              className="text-white text-xl mb-4"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              LOADING GAME...
            </h2>
            <p
              className="text-white text-sm opacity-80 mb-6"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              {loadingMessage}
            </p>
            
            {/* Progress bars for each step */}
            <div className="space-y-3 max-w-md mx-auto">
              {[1, 2, 3, 4, 5].map((step) => {
                const progress = stepProgress[step] || 0;
                const isActive = currentStep === step;
                const isComplete = currentStep > step;
                
                return (
                  <div key={step} className="w-full">
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-xs ${
                          isActive ? 'text-white' : isComplete ? 'text-green-400' : 'text-gray-500'
                        }`}
                        style={{ fontFamily: "'Press Start 2P', monospace" }}
                      >
                        STEP {step}
                      </span>
                      <span
                        className={`text-xs ${
                          isActive ? 'text-white' : isComplete ? 'text-green-400' : 'text-gray-500'
                        }`}
                        style={{ fontFamily: "'Press Start 2P', monospace" }}
                      >
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 border-2 border-gray-700 h-4 relative overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isComplete ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-gray-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                      {/* Pixelated effect */}
                      <div className="absolute inset-0 opacity-20" style={{
                        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-2xl mx-4">
          <h1
            className="text-2xl mb-4 text-red-400"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            ERROR
          </h1>
          <p
            className="text-sm opacity-80 mb-6"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            {error}
          </p>
          <div className="space-y-2 text-xs opacity-60" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            <p>TROUBLESHOOTING:</p>
            <p>• Check camera permissions in browser settings</p>
            <p>• Ensure camera is connected and not in use</p>
            <p>• Try refreshing the page</p>
            <p>• Check browser console for details</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 pixel-button-glass"
          >
            RETRY
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 pixel-button-glass"
            >
              BACK TO MENU
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Main 3D game scene */}
      <div className="w-full h-screen">
        <GameScene poseState={poseState} imuData={imuData} onLevelReady={() => setLevelReady(true)} />
      </div>

      {/* Raw IMU Data Display - Top left of main game scene */}
      {imuData && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-70 px-4 py-3 rounded z-50">
          <p
            className="text-white text-xs mb-2"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            RAW IMU DATA
          </p>
          <div
            className="text-white text-xs space-y-1"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            <p>accel_g: [{imuData.accel_g[0].toFixed(6)}, {imuData.accel_g[1].toFixed(6)}, {imuData.accel_g[2].toFixed(6)}]</p>
            <p>angularv: [{imuData.angularv_rad_s[0].toFixed(6)}, {imuData.angularv_rad_s[1].toFixed(6)}, {imuData.angularv_rad_s[2].toFixed(6)}]</p>
            <p className="text-[10px] opacity-70">time: {imuData.time_ms}ms</p>
          </div>
        </div>
      )}

      {/* Camera feed in bottom left corner - fixed position */}
      <div className="absolute bottom-4 left-4 w-64 h-48 bg-black border-2 border-white rounded overflow-hidden z-50">
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ objectFit: 'contain', zIndex: 10 }}
          />
          
          {/* Pose state indicator */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded">
            <p
              className="text-white text-xs"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              {poseState.toUpperCase()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

