import { useEffect, useState, useCallback } from "react";
import { MapPin, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import CameraCapture from "./CameraCapture";
import { attendanceService } from "../services/attendanceService";

interface CheckInModalProps {
  open: boolean;
  employeeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Coords = { latitude: number; longitude: number; accuracy?: number };

/**
 * Check-in flow that REQUIRES both live location and a selfie before it will
 * submit. Steps shown to the user:
 *   1. Grant location  -> we read GPS coordinates
 *   2. Capture a photo -> live camera, snap a frame
 *   3. Confirm         -> uploads the photo to /api/files, then POSTs check-in
 *
 * If either location or camera is denied, check-in is blocked (matching the
 * server-side requirement in AttendanceService.checkIn).
 *
 * NOTE: adjust the import paths ("./ui/Modal", "../services/…") to match where you
 * drop this file. As written it assumes: src/components/CheckInModal.tsx with
 * Modal/Button under src/components/ui and services under src/services.
 */
export default function CheckInModal({
  open,
  employeeId,
  onClose,
  onSuccess,
}: CheckInModalProps) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const requestLocation = useCallback(() => {
    setLocError(null);
    setLocLoading(true);
    if (!("geolocation" in navigator)) {
      setLocError("Geolocation is not supported on this device.");
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocLoading(false);
      },
      (err) => {
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please allow location access to check in."
            : "Could not get your location. Please try again.",
        );
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  // Ask for location as soon as the modal opens; reset state when it closes.
  useEffect(() => {
    if (open) {
      setCoords(null);
      setPhoto(null);
      setPhotoPreview(null);
      setLocError(null);
      requestLocation();
    }
  }, [open, requestLocation]);

  const handleCapture = (file: File, previewUrl: string) => {
    setPhoto(file);
    setPhotoPreview(previewUrl);
  };

  const canSubmit = !!coords && !!photo && !submitting;

  const handleConfirm = async () => {
    if (!coords || !photo) return;
    setSubmitting(true);
    try {
      await attendanceService.checkInWithProof(
        employeeId,
        coords.latitude,
        coords.longitude,
        photo,
      );
      toast.success("Checked in successfully");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ??
          e?.message ??
          "Check-in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Check In">
      <div className="flex flex-col gap-5">
        {/* Step 1: Location */}
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <MapPin size={16} /> Location
          </h3>
          {coords ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 size={16} />
              <span>
                Location captured ({coords.latitude.toFixed(5)},{" "}
                {coords.longitude.toFixed(5)})
                {coords.accuracy ? ` · ±${Math.round(coords.accuracy)}m` : ""}
              </span>
            </div>
          ) : locLoading ? (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Getting your
              location…
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <span className="flex items-center gap-2">
                <AlertTriangle size={16} /> {locError ?? "Location needed."}
              </span>
              <button
                type="button"
                onClick={requestLocation}
                className="self-start rounded-lg bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700"
              >
                Allow location
              </button>
            </div>
          )}
        </section>

        {/* Step 2: Photo */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Photo</h3>
          <CameraCapture onCapture={handleCapture} />
        </section>

        {/* Step 3: Confirm */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            Both location and photo are required to check in.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!canSubmit}>
              {submitting ? "Checking in…" : "Confirm Check-In"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
