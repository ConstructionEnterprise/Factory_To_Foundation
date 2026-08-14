import { useMemo, useState } from "react";

import { BrowseList, PanelCard, ToolbarShell, ToolbarInput, ToolbarSelect } from "@/framework/ui";

import { robotLibraryCatalog } from "./robotLibraryCatalog";

type RobotLibraryBrowseProps = {
  activeId?: string;
  onSelect: (id: string) => void;
};

/**
 * Left panel: search + category filter over the real, recovered catalog.
 * No fabricated categories -- the filter options are derived from what's
 * actually in robotLibraryCatalog.ts, so this can never offer a category
 * with zero real entries.
 */
export default function RobotLibraryBrowse({ activeId, onSelect }: RobotLibraryBrowseProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(robotLibraryCatalog.map((a) => a.category))).sort()],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return robotLibraryCatalog.filter((asset) => {
      if (category !== "all" && asset.category !== category) return false;
      if (!q) return true;
      const haystack = [
        asset.name,
        asset.category,
        asset.engineering.geometry?.summary ?? "",
        asset.source.path,
        ...(asset.engineering.relationships ?? []).map((r) => r.description),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, category]);

  const items = filtered.map((asset) => ({
    id: asset.id,
    title: `${asset.name}${asset.immutable ? " \u{1F512}" : ""}`,
  }));

  return (
    <PanelCard
      title="Robot Library"
      toolbar={
        <ToolbarShell>
          <ToolbarInput placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <ToolbarSelect value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All categories" : c}
              </option>
            ))}
          </ToolbarSelect>
        </ToolbarShell>
      }
      className="h-full"
    >
      {items.length === 0 ? (
        <div className="p-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No entries match this search/filter. The catalog has {robotLibraryCatalog.length} real entries total --
          try clearing the filter rather than assuming the library is empty.
        </div>
      ) : (
        <BrowseList items={items} activeId={activeId} onSelect={onSelect} />
      )}
      <div className="px-3 pb-2 pt-1 text-[10px]" style={{ color: "var(--ff-text-muted)" }}>
        {filtered.length} of {robotLibraryCatalog.length} shown. {"\u{1F512}"} = protected/immutable source
      </div>
    </PanelCard>
  );
}
