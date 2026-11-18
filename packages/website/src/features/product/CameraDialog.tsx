/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../ui/Button";
import { ModalPanel } from "../../ui/Dialog";
import { SelectField } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { Spinner } from "../../ui/Spinner";

const DEVICE_KEY = "selectedCameraDevice";

/** Captures product photos from a device camera. Prefers a rear camera on phones. */
export const CameraDialog: React.FC<{
  onCapture: (file: File) => void;
  onClose: () => void;
  count: number;
}> = ({ onCapture, onClose, count }) => {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState(
    () => localStorage.getItem(DEVICE_KEY) || "",
  );
  const [state, setState] = useState<"starting" | "live" | "error">("starting");
  const [captured, setCaptured] = useState(0);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = undefined;
  };

  const start = useCallback(async (id: string) => {
    stop();
    setState("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: id ? { exact: id } : undefined,
          facingMode:
            !id && /Mobi|Android/i.test(navigator.userAgent)
              ? "environment"
              : undefined,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      stream.current = s;
      if (video.current) video.current.srcObject = s;
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "videoinput",
      );
      setDevices(list);
      setState("live");
    } catch {
      setState("error");
    }
  }, []);

  // Start once with the saved camera; picking another camera restarts the stream.
  const initialDevice = useRef(deviceId).current;
  useEffect(() => {
    void start(initialDevice);
    return stop;
  }, [start]);

  const takePhoto = () => {
    const v = video.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(
          new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" }),
        );
        setCaptured((c) => c + 1);
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <ModalPanel
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Take photos"
      placement="center"
    >
      {devices.length > 1 && (
        <SelectField
          label="Camera"
          value={deviceId || devices[0].deviceId}
          options={devices.map((d, n) => ({
            id: d.deviceId,
            label: d.label || `Camera ${n + 1}`,
          }))}
          onChange={(id) => {
            setDeviceId(id);
            localStorage.setItem(DEVICE_KEY, id);
            void start(id);
          }}
        />
      )}
      <div className="bg-bg border-line grid min-h-64 place-items-center overflow-hidden rounded-md border">
        {state === "error" ? (
          <p className="text-muted p-6 text-center">
            The camera is not available. Check that this site may use the
            camera, or choose image files instead.
          </p>
        ) : (
          <>
            {state === "starting" && (
              <Spinner label="Starting camera…" className="p-6" />
            )}
            <video
              ref={video}
              autoPlay
              playsInline
              muted
              aria-label="Camera preview"
              className={`max-h-[60vh] w-full ${state === "live" ? "block" : "hidden"}`}
            />
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted text-[13px]" role="status">
          {captured > 0
            ? `${captured} photo(s) added · ${count} image(s) in total`
            : "Photos are added to the product's images."}
        </span>
        <Button className="ml-auto" onPress={onClose}>
          Done
        </Button>
        <Button
          variant="primary"
          onPress={takePhoto}
          isDisabled={state !== "live"}
        >
          <Icon name="camera" />
          Take photo
        </Button>
      </div>
    </ModalPanel>
  );
};
