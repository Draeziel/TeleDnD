import { ContentNode } from '../types/dependencyMap';

type ValidationResult = {
  valid: boolean;
  missingReferences: string[];
  cycles: string[][];
};

/**
 * Validate that all referenced node ids exist in the index.
 */
export function findMissingReferences(index: Map<string, ContentNode>): string[] {
  const missing = new Set<string>();

  for (const node of index.values()) {
    const refs = [...(node.grants || []), ...(node.dependsOn || [])];
    for (const r of refs) {
      if (!index.has(r)) missing.add(r);
    }
  }

  return Array.from(missing);
}

/**
 * Detect cycles in the directed graph using DFS and white/gray/black marking.
 * Returns array of cycles, each cycle is an ordered list of node ids.
 */
export function detectCycles(index: Map<string, ContentNode>): string[][] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const cycles: string[][] = [];

  for (const id of index.keys()) color.set(id, WHITE);

  function dfs(u: string) {
    color.set(u, GRAY);
    const node = index.get(u);
    if (!node) {
      color.set(u, BLACK);
      return;
    }
    const edges = [...(node.grants || []), ...(node.dependsOn || [])];
    for (const v of edges) {
      const c = color.get(v) ?? WHITE;
      if (c === WHITE) {
        parent.set(v, u);
        dfs(v);
      } else if (c === GRAY) {
        // found cycle; reconstruct path v -> ... -> u -> v
        const path: string[] = [v];
        let cur: string | null = u;
        while (cur && cur !== v) {
          path.push(cur);
          cur = parent.get(cur) ?? null;
        }
        path.push(v);
        path.reverse();
        cycles.push(path);
      }
    }

    color.set(u, BLACK);
  }

  for (const id of index.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      parent.set(id, null);
      dfs(id);
    }
  }

  return cycles;
}

export function validateContentIndex(index: Map<string, ContentNode>): ValidationResult {
  const missingReferences = findMissingReferences(index);
  const cycles = detectCycles(index);
  return {
    valid: missingReferences.length === 0 && cycles.length === 0,
    missingReferences,
    cycles,
  };
}

export default null;
