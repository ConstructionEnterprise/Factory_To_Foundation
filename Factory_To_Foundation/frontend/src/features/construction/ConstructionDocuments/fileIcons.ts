import { File, FileArchive, FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Real icon-by-contentType mapping — never a fabricated preview. Actual
 * image thumbnails (real bytes, real presigned URL) are handled
 * separately in FileCard.tsx for image/* files specifically; this is only
 * the icon fallback for every other real type, based on the file's real
 * reported MIME type (never guessed from the extension alone if a real
 * contentType exists).
 */
export function iconForContentType(contentType: string): ComponentType<LucideProps> {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (contentType === "application/pdf") return FileText;
  if (
    contentType.includes("spreadsheet") ||
    contentType === "text/csv" ||
    contentType === "application/vnd.ms-excel"
  ) {
    return FileSpreadsheet;
  }
  if (contentType === "application/zip" || contentType.includes("compressed")) return FileArchive;
  return File;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
