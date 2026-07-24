import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, User } from "lucide-react";
import toast from "react-hot-toast";
import AuthedImage from "./AuthedImage";
import PhotoAdjustModal from "./PhotoAdjustModal";
import { selfService } from "../services/selfService";

interface ProfilePhotoProps {
  /** current photo url like "/api/files/{id}" (from employee.profilePhotoUrl) */
  photoUrl?: string | null;
  /** display name for the fallback initial + alt text */
  name?: string;
}

/**
 * Profile photo with self-service upload.
 *
 * - Shows the current photo via AuthedImage (the file endpoint needs the JWT, so
 *   a plain <img src> would 401 — same reason as documents/selfies).
 * - Lets the employee pick an image; it's uploaded and saved to THEIR OWN record
 *   (backend resolves the employee from the JWT).
 */
export default function ProfilePhoto({ photoUrl, name }: ProfilePhotoProps) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // AuthedImage expects a file id; extract "{id}" from "/api/files/{id}".
  const fileId = photoUrl
    ? photoUrl.split("/").filter(Boolean).pop()
    : undefined;

  const initial = (name?.trim()?.[0] ?? "").toUpperCase();

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setPendingFile(file); // opens the adjust modal
  };

  const handleAdjusted = async (blob: Blob) => {
    setPendingFile(null);
    const cropped = new File([blob], "profile-photo.jpg", {
      type: "image/jpeg",
    });
    setUploading(true);
    try {
      await selfService.updatePhoto(cropped);
      toast.success("Profile photo updated");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Could not update photo. Try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300">
          {fileId ? (
            <AuthedImage
              fileId={fileId}
              alt={name ?? "Profile"}
              className="h-full w-full object-cover"
              fallback={
                initial ? (
                  <span className="text-2xl font-semibold text-slate-500">
                    {initial}
                  </span>
                ) : (
                  <User className="text-slate-400" size={32} />
                )
              }
            />
          ) : initial ? (
            <span className="text-2xl font-semibold text-slate-500">
              {initial}
            </span>
          ) : (
            <User className="text-slate-400" size={32} />
          )}
        </div>
      </div>

      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          <Camera size={15} />
          {uploading ? "Uploading…" : "Change photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePick}
            disabled={uploading}
          />
        </label>
        <p className="mt-1 text-xs text-slate-400">JPG or PNG, up to 5 MB.</p>
      </div>

      {pendingFile && (
        <PhotoAdjustModal
          file={pendingFile}
          onConfirm={handleAdjusted}
          onCancel={() => setPendingFile(null)}
        />
      )}
    </div>
  );
}
