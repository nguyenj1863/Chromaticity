"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/app/store/useStore";
import { detectPose, initializeMoveNet } from "@/lib/tensorflow";
import * as poseDetection from "@tensorflow-models/pose-detection";

type PoseState = "standing" | "jumping" | "crouching" | "unknown";

interface SoloGameProps {
  onClose?: () => void;
}

export default function SoloGame({ onClose }: SoloGameProps) {
  const { selectedCameraDeviceId, setSelectedCameraDeviceId, cameraStream: existingStream, setCameraStream } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [poseState, setPoseState] = useState<PoseState>("unknown");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing TensorFlow...");
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousYPositionRef = useRef<number | null>(null);
  const velocityRef = useRef<number>(0);
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
        setLoadingMessage("Step 1/4: Loading TensorFlow MoveNet...");
        try {
          await initializeMoveNet();
        } catch (tfError: any) {
          console.error("TensorFlow initialization error:", tfError);
          throw new Error(`TensorFlow error: ${tfError.message || "Failed to load MoveNet model"}`);
        }
        
        // Step 2: Check camera availability
        setLoadingMessage("Step 2/4: Checking camera availability...");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not available. Please use a modern browser with camera support.");
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          throw new Error("No camera devices found. Please connect a camera and try again.");
        }
        
        // Check if the selected device ID is still valid
        if (selectedCameraDeviceId) {
          const deviceExists = videoDevices.some(device => device.deviceId === selectedCameraDeviceId);
          if (!deviceExists) {
            setSelectedCameraDeviceId(null);
          }
        }
        
        // Step 3: Use existing camera stream or request new one
        setLoadingMessage("Step 3/4: Setting up camera...");
        
        let stream: MediaStream;
        
        // Use the stream from ref (captured on mount) or from store
        const streamToUse = streamRef.current || existingStream;
        
        if (streamToUse && streamToUse.active && !streamUsedRef.current) {
          stream = streamToUse;
          streamRef.current = streamToUse; // Ensure it's in ref
          streamUsedRef.current = true; // Mark that we've used the stream
        } else if (streamUsedRef.current && streamRef.current && streamRef.current.active) {
          // Stream was already used, reuse our stored reference
          stream = streamRef.current;
        } else {
          // Request new camera access
          setLoadingMessage("Step 3/4: Requesting camera access...");
          
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
            stream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
            });
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

        setLoadingMessage("Step 4/4: Starting video stream...");
        
        if (!stream.active) {
          throw new Error("Camera stream is no longer active. It may have been disconnected.");
        }
        
        videoRef.current.srcObject = stream;
        streamRef.current = stream; // Store in ref for later use
        mountedStream = stream;
        
        try {
          await videoRef.current.play();
        } catch (playError: any) {
          console.error("Error playing video:", playError);
          throw playError;
        }
        
        // Wait for video to be ready with timeout
        setLoadingMessage("Step 4/4: Waiting for video to be ready...");
        
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
            resolve(undefined);
          };
          
          if (videoRef.current.readyState >= 2) {
            clearTimeout(timeout);
            resolve(undefined);
          } else {
            videoRef.current.onloadedmetadata = onLoaded;
            videoRef.current.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("Video element error"));
            };
          }
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
  const detectPoseState = (poses: poseDetection.Pose[]): PoseState => {
    if (poses.length === 0) return "unknown";

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
      return "unknown";
    }

    // Calculate average positions
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const headY = nose.y;

    // Calculate body height (head to hip)
    const bodyHeight = Math.abs(headY - hipY);
    if (bodyHeight < 50) return "unknown"; // Too small, likely detection error

    // Calculate velocity (change in hip position) - negative means moving up
    const currentHipY = hipY;
    const previousHipY = previousYPositionRef.current;
    
    if (previousHipY !== null) {
      const deltaY = currentHipY - previousHipY;
      // Smooth velocity with exponential moving average
      velocityRef.current = deltaY * 0.8 + velocityRef.current * 0.2;
      
      // Check for jumping: hip moving up rapidly (negative velocity)
      // Threshold: -3 pixels per frame indicates upward movement
      if (velocityRef.current < -3 && currentHipY < previousHipY) {
        return "jumping";
      }
    }
    
    previousYPositionRef.current = currentHipY;

    // Check for crouching: hips lower relative to shoulders, knees bent
    if (leftKnee && rightKnee) {
      const kneeY = (leftKnee.y + rightKnee.y) / 2;
      
      // Calculate if legs are bent (knees closer to hips than ankles)
      let legsBent = false;
      if (leftAnkle && rightAnkle) {
        const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
        const kneeToHip = Math.abs(kneeY - hipY);
        const kneeToAnkle = Math.abs(kneeY - ankleY);
        // Legs are bent if knee-to-ankle distance is significantly less than knee-to-hip
        legsBent = kneeToAnkle < kneeToHip * 0.7;
      }

      // Crouching: hips significantly lower than shoulders, and legs bent
      const hipShoulderDiff = hipY - shoulderY;
      const normalHipShoulderRatio = 0.35; // Normal: hips are ~35% of body height below shoulders
      const crouchThreshold = bodyHeight * normalHipShoulderRatio * 1.4; // 40% more than normal

      if (hipShoulderDiff > crouchThreshold && legsBent) {
        return "crouching";
      }
    }

    // Default to standing (hips at normal position, not jumping)
    if (velocityRef.current > -2) {
      return "standing";
    }

    return "unknown";
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
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Detect poses
        const poses = await detectPose(video);
        
        // Determine pose state
        const state = detectPoseState(poses);
        setPoseState(state);

        // Draw pose keypoints (optional - for debugging)
        if (poses.length > 0) {
          const pose = poses[0];
          pose.keypoints.forEach((keypoint) => {
            if (keypoint.score && keypoint.score > 0.3) {
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = "#00ff00";
              ctx.fill();
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

  // Loading screen - but render video element in background so it's available for initialization
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
        
        {/* Loading screen */}
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="mb-8">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-400"></div>
            </div>
            <h2
              className="text-white text-xl mb-4"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              LOADING GAME...
            </h2>
            <p
              className="text-white text-sm opacity-80"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              {loadingMessage}
            </p>
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
      {/* Main game area */}
      <div className="w-full h-full">
        {/* Game content will go here */}
        <div className="flex items-center justify-center h-screen">
          <p className="text-white text-xl" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            GAME AREA - POSE: {poseState.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Camera feed in bottom left corner */}
      <div className="absolute bottom-4 left-4 w-64 h-48 bg-black border-2 border-white rounded overflow-hidden">
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
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

