import { useState } from "react";

/**
 * Two independent display modes, chosen per consumer based on what the
 * underlying data actually is:
 *
 * - `indent`: flat list, manually-specified depth. Use for linear or
 *   convergent (DAG-shaped) data where a single-parent tree would
 *   misrepresent the real structure — e.g. Genealogy, where a Framing-
 *   Package can have multiple material parents.
 *
 * - `children`: real nested tree, expand/collapse per node. Use for
 *   genuine one-parent containment hierarchies — e.g. Construction
 *   (Project contains Buildings), Factory (Line contains Machines).
 *
 * A consumer uses one or the other, not both, depending on whether its
 * data is a tree or a DAG/sequence. This is not a migration in progress
 * — both are permanent, intentional options.
 */
export type BrowseListItem = {
  id: string;
  title: string;
  indent?: number;
  children?: BrowseListItem[];
};

type BrowseListProps = {
  items: BrowseListItem[];
  activeId?: string;
  onSelect: (id: string) => void;
};

type BrowseListRowProps = {
  item: BrowseListItem;
  depth: number;
  activeId?: string;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
};

function BrowseListRow({
  item,
  depth,
  activeId,
  onSelect,
  expandedIds,
  onToggle,
}: BrowseListRowProps) {
  const hasChildren = !!item.children && item.children.length > 0;
  const active = item.id === activeId;
  const expanded = expandedIds.has(item.id);
  const indent = hasChildren ? depth : item.indent ?? depth;

  return (
    <>
      <button
        onClick={() => {
          // A row with children both toggles AND calls onSelect — some
          // containers are genuinely inspectable (Robotics' ATCs, Factory's
          // Lines), others aren't (Construction's Projects). Consumers
          // decide by whether their onSelect handler recognizes the id;
          // BrowseList doesn't need to know which case it's in.
          if (hasChildren) onToggle(item.id);
          onSelect(item.id);
        }}
        className={`
          mb-1
          flex
          w-full
          items-center
          gap-1.5
          rounded-lg
          px-3
          py-2
          text-left
          transition
          ${
            active
              ? "bg-[var(--ff-accent-soft)] text-[var(--ff-accent)] font-semibold"
              : "hover:bg-gray-100"
          }
        `}
        style={{
          paddingLeft: `${indent * 18 + 12}px`,
        }}
      >
        {hasChildren && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span>{item.title}</span>
      </button>

      {hasChildren &&
        expanded &&
        item.children!.map((child) => (
          <BrowseListRow
            key={child.id}
            item={child}
            depth={depth + 1}
            activeId={activeId}
            onSelect={onSelect}
            expandedIds={expandedIds}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

/**
 * Generic indented, selectable list — the shared shape behind
 * GenealogyBrowser's and FactoryBrowse's near-identical list markup.
 * Feature Browse panels supply items + a select handler; PanelCard
 * still owns the surrounding title/border/shell.
 *
 * Items with `children` render as expand/collapse toggles (chevron,
 * same rotation/timing as CollapsibleSection) instead of selectable
 * rows; only leaf items call `onSelect`.
 */
export default function BrowseList({ items, activeId, onSelect }: BrowseListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const onToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      {items.map((item) => (
        <BrowseListRow
          key={item.id}
          item={item}
          depth={0}
          activeId={activeId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}
