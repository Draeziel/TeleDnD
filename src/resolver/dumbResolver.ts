import { ContentNode, ResolverResult } from '../types/dependencyMap';

/**
 * A minimal, traversal-only resolver.
 * - `loadNode` should return a ContentNode by id (from DB or JSON files)
 * - traversal is deterministic (FIFO queue)
 */
export async function traverseResolver(
  startNodeIds: string[],
  loadNode: (id: string) => Promise<ContentNode | undefined>
): Promise<ResolverResult> {
  const queue = [...startNodeIds];
  const visited = new Set<string>();
  const nodes: ContentNode[] = [];
  const capabilities = new Array<ContentNode['capabilities'] extends (infer U)[] ? U : any>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = await loadNode(id);
    if (!node) continue;

    nodes.push(node);
    if (node.capabilities && node.capabilities.length) {
      capabilities.push(...node.capabilities);
    }

    const edges = [...(node.grants || []), ...(node.dependsOn || [])];
    for (const to of edges) {
      if (!visited.has(to)) queue.push(to);
    }
  }

  return {
    nodes,
    capabilities: capabilities as any,
  };
}

export function traverseResolverSync(
  startNodeIds: string[],
  loadNodeSync: (id: string) => ContentNode | undefined
): ResolverResult {
  const queue = [...startNodeIds];
  const visited = new Set<string>();
  const nodes: ContentNode[] = [];
  const capabilities: any[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = loadNodeSync(id);
    if (!node) continue;

    nodes.push(node);
    if (node.capabilities && node.capabilities.length) capabilities.push(...node.capabilities);

    const edges = [...(node.grants || []), ...(node.dependsOn || [])];
    for (const to of edges) {
      if (!visited.has(to)) queue.push(to);
    }
  }

  return { nodes, capabilities };
}

export default null;
