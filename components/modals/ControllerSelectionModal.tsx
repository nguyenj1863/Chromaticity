"use client";

import { useEffect, useState } from "react";

interface ControllerDevice {
  id: string;
  name: string;
  device?: BluetoothDevice;
}

interface ControllerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectController: (controller: ControllerDevice) => void;
}

export default function ControllerSelectionModal({
  isOpen,
  onClose,
  onSelectController,
}: ControllerSelectionModalProps) {
  const [controllers, setControllers] = useState<ControllerDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setControllers([]);
      setError(null);
      setLoading(false);
      setScanning(false);
    }
  }, [isOpen]);

  const scanForControllers = async () => {
    setLoading(true);
    setScanning(true);
    setError(null);
    setControllers([]);

    try {
      // Check if Web Bluetooth API is available
      if (!navigator.bluetooth) {
        setError("Web Bluetooth not supported. Please use Chrome/Edge on desktop or Android.");
        setLoading(false);
        setScanning(false);
        return;
      }

      // Request Bluetooth device with the service UUID
      const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
      
      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [SERVICE_UUID] }],
          optionalServices: [SERVICE_UUID],
        });

        if (device) {
          const controller: ControllerDevice = {
            id: device.id,
            name: device.name || `ESP32 Controller ${device.id.substring(0, 8)}`,
            device: device, // Store the device object for later connection
          };
          setControllers([controller]);
          setScanning(false);
        }
      } catch (err: any) {
        if (err.name === "NotFoundError") {
          setError("No controllers found. Make sure your ESP32 is powered on and advertising.");
        } else if (err.name === "SecurityError") {
          setError("Bluetooth permission denied. Please allow access.");
        } else if (err.name === "NetworkError") {
          setError("Connection failed. Please try again.");
        } else {
          setError(err.message || "Failed to scan for controllers");
        }
      }
    } catch (err: any) {
      console.error("Error scanning for controllers:", err);
      setError(err.message || "Failed to scan for controllers");
    } finally {
      setLoading(false);
      setScanning(false);
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

  const handleSelect = (controller: ControllerDevice) => {
    onSelectController(controller);
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
            SELECT CONTROLLER
          </h2>

          {!loading && !error && controllers.length === 0 && !scanning && (
            <div className="text-center text-white py-8" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              <p className="text-sm mb-4">SCAN FOR CONTROLLERS</p>
              <p className="text-xs mb-6 opacity-60">Make sure your ESP32 is powered on</p>
              <button
                onClick={scanForControllers}
                className="pixel-button-glass"
              >
                START SCAN
              </button>
            </div>
          )}

          {loading && scanning && (
            <div className="text-center text-white py-8" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              <p className="text-sm">SCANNING FOR CONTROLLERS...</p>
              <p className="text-xs mt-2 opacity-60">Select a device from the browser popup</p>
            </div>
          )}

          {error && (
            <div className="text-center text-red-400 py-8" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              <p className="text-sm mb-4">{error}</p>
              <button
                onClick={scanForControllers}
                className="pixel-button-glass mt-4"
              >
                TRY AGAIN
              </button>
            </div>
          )}

          {!loading && !error && controllers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-white mb-3 text-center opacity-80" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                AVAILABLE CONTROLLERS:
              </p>
              {controllers.map((controller, index) => (
                <button
                  key={controller.id}
                  onClick={() => handleSelect(controller)}
                  className="w-full pixel-button-glass text-left p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm md:text-base">
                      {controller.name}
                    </span>
                    <span className="text-xs opacity-60">
                      #{index + 1}
                    </span>
                  </div>
                </button>
              ))}
              <button
                onClick={scanForControllers}
                className="w-full pixel-button-glass mt-4"
              >
                SCAN FOR MORE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

