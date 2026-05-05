let counter = 0;

export function generateId(prefix = "win"): string {
  counter++;
  return `${prefix}-${Date.now()}-${counter}`;
}
