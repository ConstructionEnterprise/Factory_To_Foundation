import { useCallback, useEffect, useRef, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { CollapsibleSection } from "@/framework/ui";

import { initiateUpload, listFiles, uploadToPresignedUrl, PROJECT_FILE_CATEGORIES, type ProjectFile } from "../projectFilesApi";
import FileCard from "./FileCard";

type ConstructionDocumentsProps = {
  projectId: string;
  treeNodeId: string;
};

/**
 * Construction Document Management — real category folders (the brief's 4
 * real values) for a given project, each holding real file cards backed by
 * the real S3-uploaded documents for that exact project. Scaffolding-phase
 * honesty: an empty category is just empty, never a fabricated "no
 * documents" illustration beyond plain text.
 *
 * Reused verbatim from Phase 4 of the original build — only its mount
 * point changed (Construction tab reorg): originally mounted once per
 * selected tree node inside the old Inspector (any node — project,
 * building, or floor); now mounted once per project inside the new left
 * panel (ConstructionProjects.tsx), always with the project's own id as
 * treeNodeId. The outer "Documents" sub-section wrapper (a top border +
 * header, styled for appearing after other Inspector content) was removed
 * since this is now the sole content of its own CollapsibleSection, which
 * already has its own header.
 */
export default function ConstructionDocuments({ projectId, treeNodeId }: ConstructionDocumentsProps) {
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const createPermission = usePermission("construction", "create");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const reload = useCallback(() => {
    listFiles(projectId, treeNodeId)
      .then((rows) => {
        setFiles(rows);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [projectId, treeNodeId]);

  useEffect(() => {
    setFiles(null);
    reload();
  }, [reload]);

  async function handleUploadChosen(category: string, chosen: File) {
    setUploadingCategory(category);
    setError(null);
    try {
      const { uploadUrl } = await initiateUpload({
        projectId,
        treeNodeId,
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
    <div>
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
          {PROJECT_FILE_CATEGORIES.map((category) => {
            const categoryFiles = files.filter((f) => f.category === category);
            return (
              <CollapsibleSection
                key={category}
                title={`${category} (${categoryFiles.length})`}
                storageKey={`construction-docs-${treeNodeId}-${category}`}
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
                      <FileCard key={file.fileId} file={file} onChanged={reload} />
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
