// Deliberately non-deterministic fixture used only to prove the determinism
// linter detects what it claims to. Never imported by application code.

export function nowMs(): number {
  return Date.now();
}

export function randomId(): string {
  return crypto.randomUUID();
}

export function randomFloat(): number {
  return Math.random();
}

export function unstableSort(items: number[]): number[] {
  return items.sort();
}

export function fetchSomething(): Promise<Response> {
  return fetch("https://example.com");
}

export function wallClockAnnotationOnly(): number {
  // determinism-lint-allow: telemetry wall-clock annotation path (SPEC/05 §3)
  return performance.now();
}
