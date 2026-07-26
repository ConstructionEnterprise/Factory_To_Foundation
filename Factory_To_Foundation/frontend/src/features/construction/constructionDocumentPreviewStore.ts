import { useSyncExternalStore } from "react";

import type { ProjectFile } from "./projectFilesApi";

/**
 * Which document (if any) the Construction tab's center panel should show
 * instead of the map. Deliberately NOT part of SelectionContext — that's
 * one global discriminated union shared by every feature, and a "selected
 * document" shape only exists for Construction; folding it in there would
 * force every other feature's payload type to account for a shape they
 * never use. Same small module-level useSyncExternalStore pattern as
 * constructionSiteStore.ts — no context provider needed, no prop-drilling:
 * FileCard.tsx calls selectDocumentForPreview() directly on click,
 * ConstructionPage.tsx reads useDocumentPreview() directly to decide the
 * center panel's content.
 */

type PreviewState = { file: ProjectFile | null };

let state: PreviewState = { file: null };
const listeners = new Set<() => void>();

function emit(next: PreviewState) {
  state = next;
  listeners.forEach((l) => l());
}

export function useDocumentPreview(): PreviewState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}

export function selectDocumentForPreview(file: ProjectFile) {
  emit({ file });
}

export function clearDocumentPreview() {
  if (state.file !== null) emit({ file: null });
}
