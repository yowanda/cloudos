/**
 * Cross-window drag/drop protocol for the CloudOS shell.
 *
 * Anything that's "a path inside the VFS" rides the same custom MIME
 * type so the receiver doesn't have to know which window the drag came
 * from. External OS files (DataTransfer.files) are handled separately
 * by each receiver because they need different read modes (text vs
 * data-URL).
 */
export const VFS_DRAG_MIME = "application/x-cloudos-vfs-path";

/** Source helper: pin a VFS path onto a DragEvent. */
export function setVfsDragPath(e: DragEvent, path: string): void {
  e.dataTransfer?.setData(VFS_DRAG_MIME, path);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "copyMove";
}

/** Receiver helper: read a VFS path off a DragEvent (or `null`). */
export function getVfsDragPath(e: DragEvent): string | null {
  const v = e.dataTransfer?.getData(VFS_DRAG_MIME);
  return v && v.length > 0 ? v : null;
}

/** True if the drag carries any payload we accept (VFS path OR OS files). */
export function isAcceptableDrop(e: DragEvent): boolean {
  if (!e.dataTransfer) return false;
  const types = e.dataTransfer.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (t === VFS_DRAG_MIME || t === "Files") return true;
  }
  return false;
}
