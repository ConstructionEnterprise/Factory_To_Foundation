import type { FormEvent } from "react";

import { ToolbarButton, ToolbarInput, ToolbarShell } from "@/framework/ui";

type InventoryToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
};

/**
 * Real Inventory search — the "Filters" ribbon capability (per the FF
 * standing UI rule: sidebar = domain, CommandRibbon = capability, workspace
 * = view). Filters the real InventoryItem list server-side by title
 * (GET /inventory-items?query=...), matching across both real kinds
 * (Asset and Genealogy) in one search, same as Reports' Document Search.
 */
export default function InventoryToolbar({ query, onQueryChange, onSearch }: InventoryToolbarProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch();
  }

  return (
    <ToolbarShell>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <ToolbarInput
          placeholder="Search by name…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <ToolbarButton type="submit">Search</ToolbarButton>
        {query && (
          <ToolbarButton
            type="button"
            onClick={() => {
              onQueryChange("");
              onSearch();
            }}
          >
            Reset
          </ToolbarButton>
        )}
      </form>
    </ToolbarShell>
  );
}
