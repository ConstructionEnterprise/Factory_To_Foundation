import { useCallback, useEffect, useRef, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { CollapsibleSection } from "@/framework/ui";

import { initiateUpload, listDocuments, uploadToPresignedUrl, LOGISTICS_DOCUMENT_CATEGORIES, type LogisticsDocumentFile } from "../logisticsDocumentsApi";
import LogisticsFileCard from "./LogisticsFileCard";

type LogisticsDocumentsProps = {
  dispatchId: string;
};

/**
 * Real Logistics Document Management (Phase 5's backend, given a real
 * frontend at last) — real category folders (Bill of Lading/Delivery
 * Manifest/Proof of Delivery/Inspection & Compliance) for a given real
 * dispatch, each holding real file cards backed by real S3-uploaded
 * documents for that exact dispatch. An empty category is just empty,
 * never a fabricated "no documents" illustration beyond plain text — same
 * discipline as Construction's own document management at its own
 * equivalent phase.
 *
 * Mirrors ConstructionDocuments.tsx's real shape almost exactly, scoped by
 * `dispatchId` instead of `projectId`/`treeNodeId` (LogisticsDocument has
 * no tree-node equivalent to nest under — a dispatch is a flat record, not
 * a hierarchy). Mounted inside LogisticsInspector's real Dispatch view
 * (Phase 8), not a provisional modal — Phase 8 already established
 * Inspector as the permanent real per-kind detail view, so a Dispatch's
 * real documents belong there directly, the same way its real
 * chain-of-custody trail already does.
 */
export default function LogisticsDocuments({ dispatchId }: LogisticsDocumentsProps) {
  const [files, setFiles] = useState<LogisticsDocumentFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const createPermission = usePermission("logistics", "create");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const reload = useCallback(() => {
    listDocuments(dispatchId)
      .then((rows) => {
        setFiles(rows);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [dispatchId]);

  useEffect(() => {
    setFiles(null);
    reload();
  }, [reload]);

  async function handleUploadChosen(category: string, chosen: File) {
    setUploadingCategory(category);
    setError(null);
    try {
      const { uploadUrl } = await initiateUpload({
        dispatchId,
        category,
        originalFilename: chosen.name,
        contentType: chosen.type || "application/octet-stream",
        sizeBytes: chosen.size,
      });
      await uploadToPresignedUrl(uploadUrl, chosen);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingCategory(null);
    }
  }

  return (
    <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--ff-panel-border)" }}>
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
        Documents
      </h3>

      {files === null && !error && (
        <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
          Loading documents…
        </p>
      )}

      {error && (
        <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}

      {files !== null && (
        <div className="mt-2 space-y-1">
          {LOGISTICS_DOCUMENT_CATEGORIES.map((category) => {
            const categoryFiles = files.filter((f) => f.category === category);
            return (
              <CollapsibleSection
                key={category}
                title={`${category} (${categoryFiles.length})`}
                storageKey={`logistics-docs-${dispatchId}-${category}`}
              >
                <input
                  ref={(el) => {
                    fileInputRefs.current[category] = el;
                  }}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    e.target.value = "";
                    if (chosen) void handleUploadChosen(category, chosen);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[category]?.click()}
                  disabled={!createPermission.allowed || uploadingCategory === category}
                  title={createPermission.reason}
                  className="mb-2 rounded px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--ff-accent)" }}
                >
                  {uploadingCategory === category ? "Uploading…" : "Upload"}
                </button>

                {categoryFiles.length === 0 ? (
                  <p className="text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                    No documents yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {categoryFiles.map((file) => (
                      <LogisticsFileCard key={file.fileId} file={file} onChanged={reload} />
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
