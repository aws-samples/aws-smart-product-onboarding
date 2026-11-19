/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/** Errors that more constraints cannot fix: the person or the browser said no. */
const FINAL_ERRORS = ["NotAllowedError", "SecurityError"];

/**
 * Opens a camera. The size and, on phones, the rear camera are preferences: when the camera can't meet
 * them, they are dropped, and as a last resort any camera is used. A chosen camera is kept while
 * that works. Rejects when no attempt works, or at once when access was refused. `current` says
 * whether the caller still wants this camera: once it doesn't, no further attempt is made.
 */
export async function openCamera(
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>,
  cameraId: string,
  mobile: boolean,
  current: () => boolean = () => true,
): Promise<MediaStream> {
  const size = { width: { ideal: 1280 }, height: { ideal: 1280 } };
  const device = cameraId ? { deviceId: { exact: cameraId } } : undefined;
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        ...device,
        ...(!cameraId && mobile ? { facingMode: "environment" } : {}),
        ...size,
      },
    },
    ...(device ? [{ video: device }] : []),
    { video: true },
  ];
  let failure: unknown;
  for (const constraints of attempts) {
    try {
      return await getUserMedia(constraints);
    } catch (e) {
      failure = e;
      if (FINAL_ERRORS.includes((e as { name?: string })?.name ?? "")) break;
      if (!current()) break;
    }
  }
  throw failure;
}
