import type { SessionEffect, SessionMonsterEffect } from '../types/models';

export type CombatActorEntry = {
  kind: 'character' | 'monster';
  id: string;
  characterId?: string;
  name: string;
  initiative: number;
  currentHp: number;
  maxHp: number | null;
  armorClass: number | null;
  avatarText: string;
  iconUrl?: string | null;
  isActive: boolean;
  effects: Array<SessionEffect | SessionMonsterEffect>;
};
