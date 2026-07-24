import { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import Button from "./ui/Button";

interface PhotoAdjustModalProps {
  /** The raw file the user just picked. */
  file: File;
  /** Called with the final cropped image, ready to upload. */
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const OUTPUT_SIZE = 480; // px, square output
const FRAME_SIZE = 260; // px, on-screen preview size

/**
 * Lets the user zoom and drag their photo within a circular frame before it's
 * uploaded, instead of uploading whatever crop the raw file happened to have.
 */
export default function PhotoAdjustModal({
  file,
  onConfirm,
  onCancel,
}: PhotoAdjustModalProps) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1); // 1 = smallest size that still covers the frame
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // px, drag position
  const dragRef = useRef<{
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () =>
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Base scale: smallest zoom (1x) covers the frame fully (like object-fit: cover).
  const baseScale =
    naturalSize.w && naturalSize.h
      ? Math.max(FRAME_SIZE / naturalSize.w, FRAME_SIZE / naturalSize.h)
      : 1;
  const displayScale = baseScale * zoom;
  const displayW = naturalSize.w * displayScale;
  const displayH = naturalSize.h * displayScale;

  const clampOffset = (x: number, y: number) => {
    // Don't let the image be dragged so far that empty space shows in the frame.
    const maxX = Math.max(0, (displayW - FRAME_SIZE) / 2);
    const maxY = Math.max(0, (displayH - FRAME_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  // Re-clamp whenever zoom changes (zooming out can leave the old offset out of range).
  useEffect(() => {
    setOffset((o) => clampOffset(o.x, o.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, naturalSize.w, naturalSize.h]);

  const handleConfirm = () => {
    if (!imgUrl || !naturalSize.w) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d")!;

      // Map the on-screen frame coordinates to the source image's pixel space.
      const outputScale = OUTPUT_SIZE / FRAME_SIZE;
      const sScale = displayScale; // on-screen px per source px
      const srcVisibleW = FRAME_SIZE / sScale;
      const srcVisibleH = FRAME_SIZE / sScale;
      const srcCenterX = naturalSize.w / 2 - offset.x / sScale;
      const srcCenterY = naturalSize.h / 2 - offset.y / sScale;
      const sx = srcCenterX - srcVisibleW / 2;
      const sy = srcCenterY - srcVisibleH / 2;

      ctx.drawImage(
        img,
        sx,
        sy,
        srcVisibleW,
        srcVisibleH,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );
      canvas.toBlob(
        (blob) => {
          if (blob) onConfirm(blob);
        },
        "image/jpeg",
        0.92,
      );
    };
    img.src = imgUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            Adjust your photo
          </h3>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="relative mx-auto touch-none overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-300"
          style={{ width: FRAME_SIZE, height: FRAME_SIZE, cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {imgUrl && naturalSize.w > 0 && (
            <img
              src={imgUrl}
              alt="Preview"
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{
                width: displayW,
                height: displayH,
                left: FRAME_SIZE / 2 - displayW / 2 + offset.x,
                top: FRAME_SIZE / 2 - displayH / 2 + offset.y,
              }}
            />
          )}
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">
          Drag to reposition
        </p>

        <div className="mt-4 flex items-center gap-2">
          <ZoomIn size={16} className="shrink-0 text-slate-400" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!imgUrl}>
            Use this photo
          </Button>
        </div>
      </div>
    </div>
  );
}
