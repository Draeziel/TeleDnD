import fs from 'fs';
import path from 'path';
import { ContentNode } from '../types/dependencyMap';

function readJsonFileSync(filePath: string) {
  const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
  return JSON.parse(raw) as ContentNode;
}

export function buildContentIndexSync(contentRoot = path.resolve(__dirname, '../../content')): Map<string, ContentNode> {
  const index = new Map<string, ContentNode>();

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && e.name.endsWith('.json')) {
        try {
          const node = readJsonFileSync(full);
          if (node && node.id) index.set(node.id, node);
        } catch (err) {
          // ignore malformed files for now
        }
      }
    }
  }

  if (fs.existsSync(contentRoot)) walk(contentRoot);
  return index;
}

export function loadNodeSyncFromIndex(index: Map<string, ContentNode>, id: string): ContentNode | undefined {
  return index.get(id);
}

export async function buildContentIndex(contentRoot = path.resolve(__dirname, '../../content')): Promise<Map<string, ContentNode>> {
  return buildContentIndexSync(contentRoot);
}

export async function loadNodeFromIndex(index: Map<string, ContentNode>, id: string): Promise<ContentNode | undefined> {
  return loadNodeSyncFromIndex(index, id);
}

export default null;
