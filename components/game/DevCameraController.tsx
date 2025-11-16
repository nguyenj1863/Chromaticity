"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface DevCameraControllerProps {
  enabled: boolean;
}

export default function DevCameraController({ enabled }: DevCameraControllerProps) {
  const { camera } = useThree();
  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);
  const moveUp = useRef(false);
  const moveDown = useRef(false);
  const isMouseDown = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const PI_2 = Math.PI / 2;

  // Initialize camera position and rotation
  useEffect(() => {
    if (enabled) {
      // Set initial camera position for dev mode (higher up, looking down)
      camera.position.set(0, 5, 10);
      camera.lookAt(0, 0, 0);
      euler.current.setFromQuaternion(camera.quaternion);
    }
  }, [enabled, camera]);

  // Keyboard controls
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          moveForward.current = true;
          break;
        case "KeyS":
        case "ArrowDown":
          moveBackward.current = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          moveLeft.current = true;
          break;
        case "KeyD":
        case "ArrowRight":
          moveRight.current = true;
          break;
        case "KeyQ":
        case "Space":
          moveUp.current = true;
          break;
        case "KeyE":
        case "KeyZ":
          moveDown.current = true;
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          moveForward.current = false;
          break;
        case "KeyS":
        case "ArrowDown":
          moveBackward.current = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          moveLeft.current = false;
          break;
        case "KeyD":
        case "ArrowRight":
          moveRight.current = false;
          break;
        case "KeyQ":
        case "Space":
          moveUp.current = false;
          break;
        case "KeyE":
        case "KeyZ":
          moveDown.current = false;
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled]);

  // Mouse controls
  useEffect(() => {
    if (!enabled) return;

    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        // Left mouse button
        isMouseDown.current = true;
        lastMousePosition.current = { x: event.clientX, y: event.clientY };
      }
    };

    const onMouseUp = () => {
      isMouseDown.current = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isMouseDown.current) return;

      const movementX = event.clientX - lastMousePosition.current.x;
      const movementY = event.clientY - lastMousePosition.current.y;

      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= movementX * 0.002;
      euler.current.x -= movementY * 0.002;
      euler.current.x = Math.max(-PI_2, Math.min(PI_2, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);

      lastMousePosition.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [enabled, camera]);

  // Movement speed
  const moveSpeed = 5.0;

  useFrame((state, delta) => {
    if (!enabled) return;

    // Calculate movement direction
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    const up = new THREE.Vector3(0, 1, 0);

    // Calculate movement based on input
    const moveVector = new THREE.Vector3();
    
    if (moveForward.current) {
      moveVector.add(forward);
    }
    if (moveBackward.current) {
      moveVector.sub(forward);
    }
    if (moveRight.current) {
      moveVector.add(right);
    }
    if (moveLeft.current) {
      moveVector.sub(right);
    }
    if (moveUp.current) {
      moveVector.add(up);
    }
    if (moveDown.current) {
      moveVector.sub(up);
    }

    // Normalize and apply speed
    if (moveVector.length() > 0) {
      moveVector.normalize();
      moveVector.multiplyScalar(moveSpeed * delta);
      camera.position.add(moveVector);
    }
  });

  return null;
}

