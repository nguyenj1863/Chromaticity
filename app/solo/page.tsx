"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/app/store/useStore";
import { detectPose, initializeMoveNet } from "@/lib/tensorflow";
import * as poseDetection from "@tensorflow-models/pose-detection";

type PoseState = "standing" | "jumping" | "unknown";

export default function SoloGamePage() {
  const { selectedCameraDeviceId, setSelectedCameraDeviceId } = useStore();
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

  // Initialize camera and TensorFlow
  useEffect(() => {
    let isMounted = true;
    let mountedStream: MediaStream | null = null;
    
    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Step 1: Initialize MoveNet
        setLoadingMessage("Step 1/4: Loading TensorFlow MoveNet...");
        console.log("Initializing TensorFlow MoveNet...");
        try {
          await initializeMoveNet();
          console.log("TensorFlow MoveNet initialized successfully");
        } catch (tfError: any) {
          console.error("TensorFlow initialization error:", tfError);
          throw new Error(`TensorFlow error: ${tfError.message || "Failed to load MoveNet model"}`);
        }
        
        // Step 2: Check camera availability
        setLoadingMessage("Step 2/4: Checking camera availability...");
        console.log("Checking camera availability...");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not available. Please use a modern browser with camera support.");
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log(`Found ${videoDevices.length} camera device(s)`);
        
        if (videoDevices.length === 0) {
          throw new Error("No camera devices found. Please connect a camera and try again.");
        }
        
          // Check if the selected device ID is still valid
        if (selectedCameraDeviceId) {
          const deviceExists = videoDevices.some(device => device.deviceId === selectedCameraDeviceId);
          if (!deviceExists) {
            console.warn(`Selected camera device ${selectedCameraDeviceId} no longer exists. Will try to use any available camera.`);
            // Clear the invalid device ID
            setSelectedCameraDeviceId(null);
          } else {
            console.log(`Selected camera device is valid: ${selectedCameraDeviceId}`);
          }
        }
        
        // Step 3: Request camera access
        setLoadingMessage("Step 3/4: Requesting camera access...");
        console.log("Requesting camera access...");
        console.log("Selected camera device ID:", selectedCameraDeviceId);
        
        // Use the selected camera device ID if available, otherwise use default
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 640 },
          height: { ideal: 480 },
        };
        
        if (selectedCameraDeviceId) {
          // Try with exact device ID first
          videoConstraints.deviceId = { exact: selectedCameraDeviceId };
          console.log(`Attempting to use selected camera device: ${selectedCameraDeviceId}`);
        } else {
          videoConstraints.facingMode = "user";
          console.log("Using default camera (no device ID selected)");
        }
        
        // Add timeout for camera access with better logging
        let stream: MediaStream;
        const startTime = Date.now();
        
        try {
          console.log("Calling getUserMedia with constraints:", JSON.stringify(videoConstraints, null, 2));
          
          const cameraPromise = navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
          });
          
          // Log when getUserMedia is called
          cameraPromise.then(() => {
            const elapsed = Date.now() - startTime;
            console.log(`getUserMedia resolved after ${elapsed}ms`);
          }).catch((err) => {
            const elapsed = Date.now() - startTime;
            console.error(`getUserMedia rejected after ${elapsed}ms:`, err);
          });
          
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              const elapsed = Date.now() - startTime;
              console.error(`Camera access timeout after ${elapsed}ms (10 second limit)`);
              reject(new Error("Camera access timeout after 10 seconds. The camera may be in use by another application or the browser may be waiting for permission."));
            }, 10000);
          });
          
          stream = await Promise.race([cameraPromise, timeoutPromise]);
          const elapsed = Date.now() - startTime;
          console.log(`Camera access granted successfully after ${elapsed}ms`);
        } catch (cameraError: any) {
          console.error("Camera access error:", cameraError);
          
          // If exact device ID failed, try with ideal instead
          if (selectedCameraDeviceId && cameraError.name === 'OverconstrainedError') {
            console.log("Exact device ID failed, trying with ideal constraint...");
            try {
              const fallbackConstraints: MediaTrackConstraints = {
                width: { ideal: 640 },
                height: { ideal: 480 },
                deviceId: { ideal: selectedCameraDeviceId },
              };
              
              const fallbackPromise = navigator.mediaDevices.getUserMedia({
                video: fallbackConstraints,
              });
              
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error("Camera access timeout with fallback.")), 10000);
              });
              
              stream = await Promise.race([fallbackPromise, timeoutPromise]);
              console.log("Camera access granted with fallback constraint");
            } catch (fallbackError: any) {
              console.error("Fallback camera access also failed:", fallbackError);
              // Try without device ID constraint
              console.log("Trying without device ID constraint...");
              try {
                const defaultPromise = navigator.mediaDevices.getUserMedia({
                  video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user",
                  },
                });
                
                const timeoutPromise = new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error("Camera access timeout with default.")), 10000);
                });
                
                stream = await Promise.race([defaultPromise, timeoutPromise]);
                console.log("Camera access granted with default constraints");
              } catch (defaultError: any) {
                console.error("All camera access attempts failed:", defaultError);
                throw new Error(`Camera access failed: ${defaultError.message || "Unknown error. Please check camera permissions and ensure the camera is not in use."}`);
              }
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

        if (videoRef.current) {
          setLoadingMessage("Step 4/4: Starting video stream...");
          console.log("Setting video source...");
          videoRef.current.srcObject = stream;
          
          console.log("Playing video...");
          await videoRef.current.play();
          
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
              // Video already loaded
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
          
          console.log("Video ready, starting pose detection...");
          setLoadingMessage("Starting pose detection...");
          
          // Small delay to ensure everything is ready
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          if (!isMounted) {
            // Component unmounted, stop the stream
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          
          mountedStream = stream;
          setIsInitialized(true);
          setIsLoading(false);
          console.log("Initialization complete!");
        }
      } catch (err: any) {
        if (!isMounted) return;
        
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
      isMounted = false;
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
  }, [selectedCameraDeviceId, setSelectedCameraDeviceId]);

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


    // Default to standing (hips at normal position, not jumping)
    if (velocityRef.current > -2) {
      return "standing";
    }

    return "unknown";
  };

  // Main pose detection loop
  useEffect(() => {
    if (!isInitialized || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const detect = async () => {
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

  // Loading screen
  if (isLoading) {
    return (
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
            GAME AREA
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

