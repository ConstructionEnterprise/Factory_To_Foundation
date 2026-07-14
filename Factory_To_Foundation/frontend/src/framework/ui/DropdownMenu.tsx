import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import "./DropdownMenu.css";

type DropdownMenuProps = {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
};

/**
 * A single Blender/VS-Code-style menu bar item: click to open a floating
 * panel anchored beneath it (never pushes surrounding content), click
 * outside or Escape to close. Controlled — open/close state lives with
 * the caller (CommandRibbon) so only one menu in a bar can be open at once.
 */
export default function DropdownMenu({
  label,
  open,
  onToggle,
  onClose,
  children,
}: DropdownMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className="dropdown-menu" ref={containerRef}>

      <button
        type="button"
        className={`dropdown-menu-trigger${open ? " dropdown-menu-trigger--open" : ""}`}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          size={14}
          className={`dropdown-menu-chevron${open ? " dropdown-menu-chevron--open" : ""}`}
        />
      </button>

      {open && (
        <div className="dropdown-menu-panel">
          {children}
        </div>
      )}

    </div>
  );
}
