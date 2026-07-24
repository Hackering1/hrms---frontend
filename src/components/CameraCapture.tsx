import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, RefreshCw, AlertTriangle } from "lucide-react";

interface CameraCaptureProps {
  /** Called with the captured selfie as a JPEG File once the user snaps a photo. */
  onCapture: (file: File, previewUrl: string) => void;
  /** Called if the camera can't be started (permission denied / no device). */
  onError?: (message: string) => void;
}

/**
 * Live webcam preview + single-frame capture.
 *
 * - Requests the front ("user") camera via getUserMedia.
 * - Draws the current video frame onto a hidden canvas, BURNS IN a timestamp,
 *   and exports a JPEG File.
 * - Cleans up the media stream on unmount (releases the camera light).
 */
export default function CameraCapture({
  onCapture,
  onError,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setCaptured(null);
    setReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported on this browser/device.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (e: any) {
      const msg =
        e?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access and try again."
          : e?.name === "NotFoundError"
            ? "No camera found on this device."
            : e?.message || "Could not start the camera.";
      setError(msg);
      onError?.(msg);
    }
  }, [onError]);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  // Burn the current date+time into the bottom-left of the captured frame so
  // the selfie carries a tamper-evident timestamp when uploaded.
  const drawTimestamp = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ) => {
    const now = new Date();
    // e.g. "17 Jul 2026, 10:42:05 AM"
    const stamp = now.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const fontSize = Math.max(14, Math.round(w * 0.032));
    ctx.font = "600 " + fontSize + "px Arial, sans-serif";
    ctx.textBaseline = "bottom";

    const paddingX = Math.round(w * 0.02);
    const paddingY = Math.round(h * 0.02);
    const textWidth = ctx.measureText(stamp).width;
    const barHeight = fontSize + paddingY;

    // Semi-transparent black bar behind the text for legibility on any background.
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, h - barHeight, textWidth + paddingX * 2, barHeight);

    // The timestamp text.
    ctx.fillStyle = "#ffffff";
    ctx.fillText(stamp, paddingX, h - Math.round(paddingY / 2));
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    drawTimestamp(ctx, w, h); // burn the timestamp into the frame
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "checkin_" + Date.now() + ".jpg", {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);
        setCaptured(url);
        stopStream(); // release camera once we have the shot
        onCapture(file, url);
      },
      "image/jpeg",
      0.85,
    );
  };

  const retake = () => startCamera();

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <AlertTriangle className="text-red-500" size={28} />
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={startCamera}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
        >
          <RefreshCw size={14} /> Retry camera
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-56 w-full overflow-hidden rounded-lg bg-slate-900">
        {captured ? (
          <img
            src={captured}
            alt="Captured selfie"
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />
        )}
        {!ready && !captured && (
          <div className="absolute inset-0 grid place-items-center text-sm text-slate-300">
            Starting camera…
          </div>
        )}
      </div>

      {captured ? (
        <button
          type="button"
          onClick={retake}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={14} /> Retake
        </button>
      ) : (
        <button
          type="button"
          onClick={snap}
          disabled={!ready}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Camera size={16} /> Capture Photo
        </button>
      )}
    </div>
  );
}
