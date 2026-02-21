export type ContentNodeType =
  | 'class'
  | 'race'
  | 'background'
  | 'feature'
  | 'item'
  | 'action'
  | 'weapon'
  | 'armor';

export type Capability = {
  id: string;
  type: 'ACTIVE' | 'PASSIVE' | 'REACTION' | 'TRIGGER';
  payload?: Record<string, unknown>;
};

export type ContentNode = {
  id: string;
  type: ContentNodeType;
  name?: { ru?: string; en?: string };
  grants?: string[]; // outgoing edges
  dependsOn?: string[]; // incoming deps we need to include
  capabilities?: Capability[];
  meta?: Record<string, unknown>;
};

export type ResolverResult = {
  nodes: ContentNode[];
  capabilities: Capability[];
};

export default null;
