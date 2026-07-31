import { useCallback, useEffect, useRef, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { PanelCard, CollapsibleSection } from "@/framework/ui";

import { initiateUpload, listDocuments, uploadToPresignedUrl, COMPLIANCE_DOCUMENT_CATEGORIES, type ComplianceDocument } from "../complianceDocumentsApi";
import ComplianceFileCard from "./ComplianceFileCard";

/**
 * Compliance & Records (A4) — real S3-backed company/employee-wide
 * document store (OSHA docs, certifications, licenses), standalone, no
 * project/dispatch scoping. Same real category-folder + file-card pattern
 * as Construction's document management, mounted directly on the
 * Administration SimplePage rather than nested under any project.
 */
export default function ComplianceRecords() {
  const [files, setFiles] = useState<ComplianceDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const createPermission = usePermission("administration", "create");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const reload = useCallback(() => {
    listDocuments()
      .then((rows) => {
        setFiles(rows);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    setFiles(null);
    reload();
  }, [reload]);

  async function handleUploadChosen(category: string, chosen: File) {
    setUploadingCategory(category);
    setError(null);
    try {
      const { uploadUrl } = await initiateUpload({
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
    <PanelCard title="Compliance & Records">
      {files === null && !error && (
        <p className="text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
          Loading real compliance records…
        </p>
      )}

      {error && (
        <p className="text-[0.65rem]" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}

      {files !== null && (
        <div className="space-y-1">
          {COMPLIANCE_DOCUMENT_CATEGORIES.map((category) => {
            const categoryFiles = files.filter((f) => f.category === category);
            return (
              <CollapsibleSection
                key={category}
                title={`${category} (${categoryFiles.length})`}
                storageKey={`compliance-records-${category}`}
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
                    No records yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {categoryFiles.map((file) => (
                      <ComplianceFileCard key={file.fileId} file={file} onChanged={reload} />
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}
