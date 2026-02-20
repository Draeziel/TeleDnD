import type { ReactNode } from 'react';
import type { SessionEffect, SessionMonsterEffect } from '../types/models';

type PrecombatCharacterEntry = {
  id: string;
  character: {
    id: string;
    name: string;
  };
  state: {
    currentHp: number;
    maxHpSnapshot: number;
    initiative: number | null;
  } | null;
  effects: Array<SessionEffect | SessionMonsterEffect>;
};

type PrecombatMonsterEntry = {
  id: string;
  nameSnapshot: string;
  currentHp: number;
  maxHpSnapshot: number;
  initiative: number | null;
  template?: {
    armorClass?: number | null;
    iconUrl?: string | null;
  } | null;
  effects: Array<SessionEffect | SessionMonsterEffect>;
};

type PrecombatActorsGridProps = {
  characters: PrecombatCharacterEntry[];
  monsters: PrecombatMonsterEntry[];
  characterArmorClass: Record<string, number | null>;
  renderStatusBadges: (effects: Array<SessionEffect | SessionMonsterEffect>) => ReactNode;
  getAvatarInitials: (name: string) => string;
  isGmViewer: boolean;
  hasActiveGm: boolean;
  removingId: string | null;
  removingMonsterId: string | null;
  onRemoveCharacter: (characterId: string) => void;
  onSetMonsterHp: (monsterId: string, currentHp: number) => void;
  onRemoveMonster: (monsterId: string) => void;
};

export function PrecombatActorsGrid({
  characters,
  monsters,
  characterArmorClass,
  renderStatusBadges,
  getAvatarInitials,
  isGmViewer,
  hasActiveGm,
  removingId,
  removingMonsterId,
  onRemoveCharacter,
  onSetMonsterHp,
  onRemoveMonster,
}: PrecombatActorsGridProps) {
  return (
    <div className="combat-actors-grid">
      {characters.map((entry) => (
        <div className="combat-actor-card combat-actor-character" key={`precombat-character-${entry.id}`}>
          <div className="combat-actor-namebar">{entry.character.name}</div>
          <div className="combat-actor-icon">{getAvatarInitials(entry.character.name)}</div>
          <div className="combat-actor-vitals-row">
            <div className="combat-actor-stat">❤️ {entry.state?.currentHp ?? 0} / {entry.state?.maxHpSnapshot ?? '—'}</div>
            <div className="combat-actor-stat">🛡 {characterArmorClass[entry.character.id] ?? '—'}</div>
          </div>
          <div className="combat-actor-status-row">
            <div className="character-tile-statuses">{renderStatusBadges(entry.effects || [])}</div>
            <div className="combat-actor-stat">🎲 {entry.state?.initiative ?? '—'}</div>
          </div>
          <button
            className="btn btn-danger btn-icon combat-actor-remove"
            aria-label={`Удалить ${entry.character.name}`}
            disabled={removingId === entry.character.id}
            onClick={() => onRemoveCharacter(entry.character.id)}
          >
            ✕
          </button>
        </div>
      ))}

      {monsters.map((monster) => (
        <div className="combat-actor-card combat-actor-monster" key={`precombat-monster-${monster.id}`}>
          <div className="combat-actor-namebar">{monster.nameSnapshot}</div>
          {monster.template?.iconUrl ? (
            <img className="combat-actor-image" src={monster.template.iconUrl} alt={monster.nameSnapshot} />
          ) : (
            <div className="combat-actor-icon">👾</div>
          )}
          <div className="combat-actor-vitals-row">
            <div className="combat-actor-stat">❤️ {monster.currentHp} / {monster.maxHpSnapshot}</div>
            <div className="combat-actor-stat">🛡 {monster.template?.armorClass ?? '—'}</div>
          </div>
          <div className="combat-actor-status-row">
            <div className="character-tile-statuses">{renderStatusBadges(monster.effects || [])}</div>
            <div className="combat-actor-stat">🎲 {monster.initiative ?? '—'}</div>
          </div>
          {isGmViewer && (
            <div className="inline-row">
              <button
                className="btn btn-secondary"
                disabled={!hasActiveGm}
                onClick={() => onSetMonsterHp(monster.id, Math.max(monster.currentHp - 1, 0))}
              >
                HP -1
              </button>
              <button
                className="btn btn-secondary"
                disabled={!hasActiveGm}
                onClick={() => onSetMonsterHp(monster.id, monster.currentHp + 1)}
              >
                HP +1
              </button>
            </div>
          )}
          {isGmViewer && (
            <button
              className="btn btn-danger btn-icon combat-actor-remove"
              aria-label={`Удалить ${monster.nameSnapshot}`}
              disabled={removingMonsterId === monster.id}
              onClick={() => onRemoveMonster(monster.id)}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
