import { useState, type FormEvent } from "react";

import { PanelCard, StatusBadge } from "@/framework/ui";
import { constructionProjects } from "@/features/construction/constructionData";
import { PROJECT_FILE_CATEGORIES, searchFiles, type ProjectFile } from "@/features/construction/projectFilesApi";

/**
 * Real enterprise-wide document search (Phase 1C, 2026-08-15; relocated
 * into its own real Reports ribbon tab 2026-08-18) — metadata/filename
 * match only (GET /construction-files/search), never full-text content
 * search (Phase 0 decision — explicitly deferred). Construction's own
 * project-scoped browsing (ConstructionDocuments.tsx) is untouched; this
 * is a second, complementary way to reach the same real ProjectFile rows,
 * not a replacement.
 */
export default function DocumentSearchReport() {
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<ProjectFile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const projectTitle = (id: string) => constructionProjects.find((p) => p.id === id)?.title ?? id;

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const rows = await searchFiles({
        query: query.trim() || undefined,
        projectId: projectId || undefined,
        category: category || undefined,
      });
      setResults(rows);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <PanelCard
      title="Document Search"
      className="h-full"
      bodyClassName="flex-1 overflow-auto p-5"
      toolbar={<StatusBadge label="Enterprise-Wide — Real Data" tone="neutral" />}
    >
      <form onSubmit={runSearch} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
            Filename contains
          </label>
          <input
            type="text"
            placeholder="e.g. submittal"
            className="w-full rounded border px-2 py-1.5 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
            Project
          </label>
          <select className="rounded border px-2 py-1.5 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">All Projects</option>
            {constructionProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
            Category
          </label>
          <select className="rounded border px-2 py-1.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {PROJECT_FILE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={searching}
          className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--ff-accent)" }}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}

      {!error && hasSearched && results && (
        <div className="mt-4">
          <p className="mb-2 text-xs" style={{ color: "var(--ff-text-muted)" }}>
            {results.length} real result{results.length === 1 ? "" : "s"} across all projects — metadata/filename
            match only, not full-text content search.
          </p>
          {results.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left" style={{ color: "var(--ff-text-muted)" }}>
                  <th className="py-1 pr-3 font-medium">Filename</th>
                  <th className="py-1 pr-3 font-medium">Project</th>
                  <th className="py-1 pr-3 font-medium">Category</th>
                  <th className="py-1 font-medium">Uploaded</th>
                </tr>
              </thead>
              <tbody style={{ color: "var(--ff-text-primary)" }}>
                {results.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--ff-panel-border)" }}>
                    <td className="py-1.5 pr-3 font-medium">{r.originalFilename}</td>
                    <td className="py-1.5 pr-3">{projectTitle(r.projectId)}</td>
                    <td className="py-1.5 pr-3">{r.category}</td>
                    <td className="py-1.5">{new Date(r.uploadedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </PanelCard>
  );
}
