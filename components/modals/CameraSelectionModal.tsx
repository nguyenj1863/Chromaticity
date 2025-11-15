"use client";

import { useEffect, useState } from "react";

interface CameraDevice {
  deviceId: string;
  label: string;
  kind: string;
}

interface CameraSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCamera: (camera: CameraDevice) => void;
}

export default function CameraSelectionModal({
  isOpen,
  onClose,
  onSelectCamera,
}: CameraSelectionModalProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCameras();
    }
  }, [isOpen]);

  const loadCameras = async () => {
    setLoading(true);
    setError(null);
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setError("Camera API not available");
        setLoading(false);
        return;
      }

      // First, request permission to get device labels
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        // Permission denied, but we can still enumerate devices (without labels)
      }

      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.substring(0, 8)}`,
          kind: device.kind,
        }));

      if (videoDevices.length === 0) {
        setError("No cameras found");
      } else {
        setCameras(videoDevices);
      }
    } catch (err) {
      console.error('Error loading cameras:', err);
      setError("Failed to load cameras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSelect = (camera: CameraDevice) => {
    onSelectCamera(camera);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-80"
      onClick={handleBackdropClick}
    >
      <div
        className="pixel-modal-glass relative w-full max-w-2xl max-h-[80vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="pixel-close-button absolute top-4 right-4 z-10"
          aria-label="Close"
        >
          ×
        </button>

        {/* Content */}
        <div className="p-8 md:p-12">
          <h2
            className="text-xl md:text-2xl text-white mb-6 text-center"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            SELECT CAMERA
          </h2>

          {loading && (
            <div className="text-center text-white py-8" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              <p className="text-sm">LOADING CAMERAS...</p>
            </div>
          )}

          {error && (
            <div className="text-center text-red-400 py-8" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              <p className="text-sm">{error}</p>
              <button
                onClick={loadCameras}
                className="pixel-button-glass mt-4"
              >
                RETRY
              </button>
            </div>
          )}

          {!loading && !error && cameras.length > 0 && (
            <div className="space-y-3">
              {cameras.map((camera, index) => (
                <button
                  key={camera.deviceId}
                  onClick={() => handleSelect(camera)}
                  className="w-full pixel-button-glass text-left p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm md:text-base">
                      {camera.label}
                    </span>
                    <span className="text-xs opacity-60">
                      #{index + 1}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && cameras.length === 0 && (
            <div className="text-center text-white py-8" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              <p className="text-sm">NO CAMERAS AVAILABLE</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

