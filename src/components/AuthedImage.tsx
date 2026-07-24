import { useEffect, useRef, useState } from "react";
import { apiClient } from "../services/apiClient";

interface AuthedImageProps {
  /** The file id (StoredFile UUID) to load from /api/files/{fileId}. */
  fileId?: string | null;
  alt?: string;
  className?: string;
  /** Optional element to show while loading or when there's no image. */
  fallback?: React.ReactNode;
}

/**
 * Renders an image served by a JWT-protected endpoint.
 *
 * A plain <img src="/api/files/{id}"> would fail with 401 because the browser
 * doesn't attach the Authorization header to image requests. This component
 * fetches the bytes through the authenticated axios client (which DOES attach the
 * bearer token), turns them into an object URL, and displays that — then revokes
 * the URL on cleanup to avoid memory leaks.
 */
export default function AuthedImage({
  fileId,
  alt = "",
  className,
  fallback = null,
}: AuthedImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUrl(null);

    if (!fileId) return;

    apiClient
      .get(`/files/${fileId}`, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        const objUrl = URL.createObjectURL(res.data as Blob);
        objectUrlRef.current = objUrl;
        setUrl(objUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [fileId]);

  if (!fileId || failed) return <>{fallback}</>;
  if (!url) return <>{fallback}</>;
  return <img src={url} alt={alt} className={className} />;
}
