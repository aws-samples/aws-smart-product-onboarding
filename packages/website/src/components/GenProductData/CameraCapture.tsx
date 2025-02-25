import {
  Button,
  Select,
  SelectProps,
  SpaceBetween,
} from "@cloudscape-design/components";
import { useEffect, useRef, useState } from "react";

export interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Function to get camera devices with labels
  const getDevicesWithLabels = async () => {
    // First get access to a camera to ensure we get labels
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      // Now enumerate devices - this should include labels
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter(
        (device) => device.kind === "videoinput",
      );

      setDevices(videoDevices);

      if (videoDevices.length > 0) {
        // Try to select a rear camera by default if on mobile
        const rearCamera = videoDevices.find(
          (device) =>
            device.label.toLowerCase().includes("back") ||
            device.label.toLowerCase().includes("rear"),
        );
        setSelectedDevice(rearCamera?.deviceId || videoDevices[0].deviceId);
      }

      // Stop the temporary stream
      tempStream.getTracks().forEach((track) => track.stop());

      // Now start the camera with the selected device
      void startCamera();
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Get available camera devices
    setIsLoading(true);
    void getDevicesWithLabels();

    navigator.mediaDevices
      .enumerateDevices()
      .then((deviceList) => {
        const videoDevices = deviceList.filter(
          (device) => device.kind === "videoinput",
        );
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          // Try to select a rear camera by default if on mobile
          const rearCamera = videoDevices.find(
            (device) =>
              device.label.toLowerCase().includes("back") ||
              device.label.toLowerCase().includes("rear"),
          );
          setSelectedDevice(rearCamera?.deviceId || videoDevices[0].deviceId);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error enumerating devices:", err);
        setIsLoading(false);
      });
  }, []);

  const startCamera = async () => {
    try {
      setIsLoading(true);
      const constraints = {
        video: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          facingMode:
            !selectedDevice && /Mobi|Android/i.test(navigator.userAgent)
              ? "environment"
              : undefined,
        },
      };

      const mediaStream =
        await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsLoading(false);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(undefined);
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Could not get canvas context");
        return;
      }
      ctx.drawImage(videoRef.current, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("Failed to create blob from canvas");
          return;
        }
        const file = new File([blob], `photo_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
        stopCamera();
      }, "image/jpeg");
    }
  };

  const handleDeviceChange = (e: { detail: SelectProps.ChangeDetail }) => {
    setSelectedDevice(e.detail.selectedOption.value || "");
    if (stream) {
      stopCamera();
      setTimeout(startCamera, 100);
    }
  };
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div>
      {devices.length > 0 && (
        <Select
          selectedOption={{
            value: selectedDevice,
            label:
              devices.find((d) => d.deviceId === selectedDevice)?.label ||
              "Camera",
          }}
          onChange={handleDeviceChange}
          options={devices.map((device) => ({
            value: device.deviceId,
            label: device.label || `Camera ${devices.indexOf(device) + 1}`,
          }))}
          placeholder="Select camera"
          disabled={isLoading}
        />
      )}

      <div style={{ margin: "1rem 0" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            maxWidth: "400px",
            display: stream ? "block" : "none",
          }}
        />
      </div>

      <SpaceBetween direction="horizontal" size="s">
        {!stream ? (
          <Button onClick={startCamera} loading={isLoading}>
            Start Camera
          </Button>
        ) : (
          <Button onClick={takePhoto} variant="primary">
            Take Photo
          </Button>
        )}
        <Button
          onClick={() => {
            stopCamera();
            onCancel();
          }}
        >
          Cancel
        </Button>
      </SpaceBetween>
    </div>
  );
};

export default CameraCapture;
