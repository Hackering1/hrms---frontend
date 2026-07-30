import { useRef, useState } from "react";
import { Upload, FileCheck, Loader2, X } from "lucide-react";
import { fileService } from "../../services/fileService";

interface Props {
  // called with the stored file's URL ("/api/files/{id}") and original name
  onUploaded: (url: string, fileName: string) => void;
  // current value (url) so the component can show "already uploaded"
  value?: string;
  label?: string;
  accept?: string;
  // max file size in MB (default 5)
  maxSizeMB?: number;
  // Optional override for how the file is actually uploaded. Defaults to the
  // authenticated fileService.upload (JWT attached) — every existing usage of
  // this component keeps working exactly as before. The public onboarding page
  // passes a token-scoped upload function instead, since the candidate has no
  // JWT yet.
  uploadFn?: (file: File) => Promise<{ url: string; fileName: string }>;
}

export default function FileUpload({
  onUploaded,
  value,
  label = "Attach file",
  accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg",
  maxSizeMB = 5,
  uploadFn,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string>("");
  const [error, setError] = useState<string>("");

  const pick = () => inputRef.current?.click();

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size limit.
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError("File must be under " + maxSizeMB + " MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    // Type check against the accept list (extension-based).
    const allowed = accept
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);
    const lower = file.name.toLowerCase();
    const okType =
      allowed.length === 0 || allowed.some((ext) => lower.endsWith(ext));
    if (!okType) {
      setError("Allowed file types: " + accept);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = uploadFn
        ? await uploadFn(file)
        : await fileService.upload(file);
      setName(res.fileName);
      onUploaded(res.url, res.fileName);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = () => {
    setName("");
    onUploaded("", "");
  };

  const uploaded = !!value;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handle}
      />

      {!uploaded ? (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          {busy ? "Uploading…" : "Choose file (PDF, DOC, image)"}
        </button>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-green-700">
            <FileCheck size={16} /> {name || "File attached"}
          </span>
          <button
            type="button"
            onClick={clear}
            className="text-slate-400 hover:text-rose-600"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
