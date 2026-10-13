// A clean fixture: no banned APIs, and a sorted .sort(comparator) call.

export function sortedCopy(items: readonly number[]): number[] {
  return items.slice().sort((a, b) => a - b);
}

export function add(a: number, b: number): number {
  return a + b;
}
