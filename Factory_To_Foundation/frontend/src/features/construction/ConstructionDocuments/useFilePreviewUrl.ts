import { useEffect, useState } from "react";

import { getDownloadUrl, type ProjectFile } from "../projectFilesApi";

/**
 * Real presigned-download-URL fetch for image preview — the one real
 * mechanism shared between FileCard's thumbnail and the center-panel
 * ConstructionDocumentViewer, so there's a single real image-preview fetch
 * path, not two copies of the same effect. Only ever fetches for real
 * image/* files; every other content type gets null, and callers fall back
 * to the icon (fileIcons.ts), never a fabricated preview.
 */
export function useFilePreviewUrl(file: ProjectFile | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = file?.contentType.startsWith("image/") ?? false;
  const fileId = file?.fileId;

  useEffect(() => {
    setUrl(null);
    if (!fileId || !isImage) return;
    let cancelled = false;
    getDownloadUrl(fileId)
      .then((res) => {
        if (!cancelled) setUrl(res.url);
      })
      .catch(() => {
        // Honest fallback: no preview rather than a broken one — the icon still shows.
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, isImage]);

  return url;
}
