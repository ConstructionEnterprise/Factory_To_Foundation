import GenealogyBrowser from "@/features/genealogy/GenealogyBrowser/GenealogyBrowser";

/**
 * Real Genealogy report (Reports rebuild, 2026-08-18) -- the exact same
 * real component GenealogyBrowser.tsx's own doc comment describes as
 * "one live data source, two views." No new read path, no new component
 * logic -- this file exists only to give Genealogy its own real Reports
 * ribbon tab.
 */
export default function GenealogyReport() {
  return <GenealogyBrowser />;
}
