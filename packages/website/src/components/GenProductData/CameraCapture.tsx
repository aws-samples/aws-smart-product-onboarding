/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  Box,
  Button,
  FileTokenGroup,
  FileTokenGroupProps,
  Grid,
  Modal,
  Select,
  SelectProps,
  SpaceBetween,
} from "@cloudscape-design/components";
import React, { useEffect, useRef, useState } from "react";

export interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  visible: boolean;
  imageFiles: File[];
  setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onCancel,
  visible,
  imageFiles,
  setImageFiles,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [windowHeight, setWindowHeight] = useState(0);

  useEffect(() => {
    // Set initial window height
    setWindowHeight(window.innerHeight);

    // Update window height when it changes
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    // Clean up event listener
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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

      if (selectedDevice === "" && videoDevices.length > 0) {
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
  }, []);

  const startCamera = async () => {
    try {
      setIsLoading(true);
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          facingMode:
            !selectedDevice && /Mobi|Android/i.test(navigator.userAgent)
              ? "environment"
              : undefined,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
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
      stream.getTracks().forEach((track) => {
        track.stop();
      });
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
    <Modal
      visible={visible}
      onDismiss={onCancel}
      size="max"
      header="Take Photo"
      footer={
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
            {imageFiles.length === 0 ? "Cancel" : "Close"}
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
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

        <Grid gridDefinition={[{ colspan: 10 }, { colspan: 2 }]}>
          <Box textAlign="center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                maxHeight: `${windowHeight * 0.75}px`, // 75% of window height
                display: stream ? "block" : "none",
              }}
            />
          </Box>
          <FileTokenGroup
            alignment="vertical"
            showFileThumbnail={true}
            onDismiss={({ detail }) =>
              setImageFiles((value: File[]) =>
                value.filter((_, index) => detail.fileIndex !== index),
              )
            }
            limit={3}
            items={imageFiles.map((file): FileTokenGroupProps.Item => {
              return {
                file: file,
              };
            })}
          />
        </Grid>
      </SpaceBetween>
    </Modal>
  );
};

export default CameraCapture;
