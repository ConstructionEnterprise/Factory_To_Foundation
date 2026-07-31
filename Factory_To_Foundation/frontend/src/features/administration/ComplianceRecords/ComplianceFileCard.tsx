import { useEffect, useRef, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { iconForContentType, formatBytes } from "@/features/construction/ConstructionDocuments/fileIcons";

import {
  deleteDocument,
  getDownloadUrl,
  getVersionHistory,
  initiateVersionUpload,
  renameDocument,
  uploadToPresignedUrl,
  COMPLIANCE_DOCUMENT_CATEGORIES,
  type ComplianceDocument,
} from "../complianceDocumentsApi";

type Mode = "view" | "editing" | "confirmingDelete";

type ComplianceFileCardProps = {
  file: ComplianceDocument;
  onChanged: () => void;
};

/**
 * Real Compliance & Records file card (A4) — same real upload/download/
 * replace/rename/history/delete mechanics as Construction's FileCard.tsx,
 * reusing its icon/byte-formatting helpers directly (fileIcons.ts is
 * already fully generic, no ProjectFile coupling). Deliberately no
 * click-to-preview-in-center-panel behavior — Administration is a
 * SimplePage (no center panel to preview into), same reasoning Logistics'
 * own LogisticsFileCard already used for the same gap.
 */
export default function ComplianceFileCard({ file, onChanged }: ComplianceFileCardProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftFilename, setDraftFilename] = useState(file.originalFilename);
  const [draftCategory, setDraftCategory] = useState(file.category);
  const [draftSubject, setDraftSubject] = useState(file.subject ?? "");
  const [draftSubcategory, setDraftSubcategory] = useState(file.subcategory ?? "");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ComplianceDocument[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const updatePermission = usePermission("administration", "update");
  const deletePermission = usePermission("administration", "delete");

  const Icon = iconForContentType(file.contentType);
  const isImage = file.contentType.startsWith("image/");

  useEffect(() => {
    setThumbnailUrl(null);
    if (!isImage) return;
    let cancelled = false;
    getDownloadUrl(file.fileId)
      .then((res) => {
        if (!cancelled) setThumbnailUrl(res.url);
      })
      .catch(() => {
        // Honest fallback — icon still shows.
      });
    return () => {
      cancelled = true;
    };
  }, [file.fileId, isImage]);

  async function handleDownload() {
    setError(null);
    try {
      const { url } = await getDownloadUrl(file.fileId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleReplaceFileChosen(chosen: File) {
    setBusy(true);
    setError(null);
    try {
      const { uploadUrl } = await initiateVersionUpload(file.fileId, {
        originalFilename: chosen.name,
        contentType: chosen.type || "application/octet-stream",
        sizeBytes: chosen.size,
      });
      await uploadToPresignedUrl(uploadUrl, chosen);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRename() {
    setBusy(true);
    setError(null);
    try {
      await renameDocument(file.fileId, {
        originalFilename: draftFilename.trim() || file.originalFilename,
        category: draftCategory,
        subject: draftSubject.trim() || null,
        subcategory: draftSubcategory.trim() || null,
      });
      setMode("view");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteDocument(file.fileId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMode("view");
    } finally {
      setBusy(false);
    }
  }

  async function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && history === null) {
      setHistoryLoading(true);
      try {
        setHistory(await getVersionHistory(file.fileId));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  async function handleHistoryDownload(version: number) {
    try {
      const { url } = await getDownloadUrl(file.fileId, version);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="rounded border px-3 py-2" style={{ borderColor: "var(--ff-panel-border)" }}>
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded" style={{ background: "var(--ff-chrome-bg)" }}>
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon size={18} style={{ color: "var(--ff-text-muted)" }} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {mode === "editing" ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={draftFilename}
                onChange={(e) => setDraftFilename(e.target.value)}
                className="w-full rounded border px-1.5 py-1 text-xs"
                style={{ borderColor: "var(--ff-panel-border)" }}
              />
              <select
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                className="w-full rounded border px-1.5 py-1 text-xs"
                style={{ borderColor: "var(--ff-panel-border)" }}
              >
                {COMPLIANCE_DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                placeholder="Subject (e.g. employee name, equipment id)"
                className="w-full rounded border px-1.5 py-1 text-xs"
                style={{ borderColor: "var(--ff-panel-border)" }}
              />
              <input
                type="text"
                value={draftSubcategory}
                onChange={(e) => setDraftSubcategory(e.target.value)}
                placeholder="Subcategory (optional)"
                className="w-full rounded border px-1.5 py-1 text-xs"
                style={{ borderColor: "var(--ff-panel-border)" }}
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveRename}
                  disabled={busy}
                  className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                  style={{ background: "var(--ff-accent)" }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setMode("view")}
                  disabled={busy}
                  className="rounded border px-2 py-1 text-xs"
                  style={{ borderColor: "var(--ff-panel-border)", color: "var(--ff-text-secondary)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="truncate text-xs font-medium" style={{ color: "var(--ff-text-primary)" }} title={file.originalFilename}>
                {file.originalFilename}
              </p>
              <p className="text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
                v{file.version} · {formatBytes(file.sizeBytes)}
                {file.subject ? ` · ${file.subject}` : ""}
                {file.subcategory ? ` · ${file.subcategory}` : ""}
              </p>
              <p className="text-[0.6rem]" style={{ color: "var(--ff-text-muted)" }}>
                Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
              </p>
            </>
          )}
        </div>
      </div>

      {mode !== "editing" && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownload}
            className="rounded px-2 py-1 text-[0.65rem] font-medium"
            style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
          >
            Download
          </button>

          <input
            ref={replaceInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              e.target.value = "";
              if (chosen) void handleReplaceFileChosen(chosen);
            }}
          />
          <button
            type="button"
            onClick={() => replaceInputRef.current?.click()}
            disabled={!updatePermission.allowed || busy}
            title={updatePermission.reason}
            className="rounded px-2 py-1 text-[0.65rem] font-medium disabled:opacity-50"
            style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
          >
            {busy ? "Uploading…" : "Replace"}
          </button>

          <button
            type="button"
            onClick={() => {
              setDraftFilename(file.originalFilename);
              setDraftCategory(file.category);
              setDraftSubject(file.subject ?? "");
              setDraftSubcategory(file.subcategory ?? "");
              setMode("editing");
            }}
            disabled={!updatePermission.allowed}
            title={updatePermission.reason}
            className="rounded px-2 py-1 text-[0.65rem] font-medium disabled:opacity-50"
            style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
          >
            Rename
          </button>

          <button
            type="button"
            onClick={toggleHistory}
            className="rounded px-2 py-1 text-[0.65rem] font-medium"
            style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
          >
            History
          </button>

          {mode === "confirmingDelete" ? (
            <>
              <span className="text-[0.65rem] font-medium" style={{ color: "var(--ff-status-critical)" }}>
                Delete this record?
              </span>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={busy}
                className="rounded px-2 py-1 text-[0.65rem] font-medium text-white disabled:opacity-60"
                style={{ background: "var(--ff-status-critical)" }}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setMode("view")}
                className="rounded border px-2 py-1 text-[0.65rem]"
                style={{ borderColor: "var(--ff-panel-border)", color: "var(--ff-text-secondary)" }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMode("confirmingDelete")}
              disabled={!deletePermission.allowed}
              title={deletePermission.reason}
              className="rounded px-2 py-1 text-[0.65rem] font-medium disabled:opacity-50"
              style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-status-critical)" }}
            >
              Delete
            </button>
          )}
        </div>
      )}

      {historyOpen && (
        <div className="mt-2 rounded border px-2 py-1.5" style={{ borderColor: "var(--ff-panel-border)" }}>
          <p className="text-[0.6rem] font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
            Version history
          </p>
          {historyLoading && (
            <p className="mt-1 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
              Loading…
            </p>
          )}
          {history?.map((v) => (
            <div key={v.version} className="mt-1 flex items-center justify-between text-[0.65rem]">
              <span style={{ color: "var(--ff-text-primary)" }}>
                v{v.version} — {formatBytes(v.sizeBytes)} — {new Date(v.uploadedAt).toLocaleString()}
              </span>
              <button type="button" onClick={() => handleHistoryDownload(v.version)} className="font-medium" style={{ color: "var(--ff-accent)" }}>
                Download
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[0.65rem]" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
