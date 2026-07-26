import { PanelCard } from "@/framework/ui";

import { getDownloadUrl } from "../projectFilesApi";
import { clearDocumentPreview, useDocumentPreview } from "../constructionDocumentPreviewStore";
import { formatBytes, iconForContentType } from "../ConstructionDocuments/fileIcons";
import { useFilePreviewUrl } from "../ConstructionDocuments/useFilePreviewUrl";

/**
 * Construction tab reorganization — the center panel's alternate mode.
 * ConstructionMap.tsx (unchanged) is the default; ConstructionPage.tsx
 * swaps to this instead whenever constructionDocumentPreviewStore has a
 * file selected (set by clicking a document in the new left panel's
 * FileCard rows).
 *
 * Real image files get a real full preview via useFilePreviewUrl — the
 * exact same presigned-URL fetch FileCard's own thumbnail uses, not a
 * second copy of that logic. Every other content type gets the same
 * fileIcons.ts icon FileCard already uses, plus a real Download action
 * (same getDownloadUrl + window.open FileCard's own Download button
 * calls) — no generic in-browser preview is attempted for non-image types,
 * since nothing in this stack can render a PDF/docx generically without a
 * heavier library that was never asked for.
 */
export default function ConstructionDocumentViewer() {
  const { file } = useDocumentPreview();
  const previewUrl = useFilePreviewUrl(file);

  if (!file) return null;

  const Icon = iconForContentType(file.contentType);
  const isImage = file.contentType.startsWith("image/");

  async function handleDownload() {
    if (!file) return;
    const { url } = await getDownloadUrl(file.fileId);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <PanelCard
      title={file.originalFilename}
      className="h-[560px]"
      bodyClassName="flex flex-1 flex-col"
      toolbar={
        <button
          type="button"
          onClick={clearDocumentPreview}
          className="rounded px-2 py-1 text-xs font-medium"
          style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
          title="Close this document and return to the map"
        >
          Close
        </button>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={file.originalFilename}
            className="max-h-full max-w-full rounded object-contain"
          />
        ) : (
          <>
            <Icon size={64} style={{ color: "var(--ff-text-muted)" }} />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "var(--ff-text-primary)" }}>
                {file.originalFilename}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--ff-text-muted)" }}>
                v{file.version} · {formatBytes(file.sizeBytes)}
                {isImage ? " · loading preview…" : ` · ${file.contentType}`}
              </p>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleDownload}
          className="rounded px-3 py-1.5 text-xs font-medium text-white"
          style={{ background: "var(--ff-accent)" }}
        >
          Download
        </button>
      </div>
    </PanelCard>
  );
}
