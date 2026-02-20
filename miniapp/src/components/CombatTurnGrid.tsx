import type { ReactNode } from 'react';
import type { SessionEffect, SessionMonsterEffect } from '../types/models';
import type { CombatActorEntry } from './CombatTypes';

type CombatTurnGridProps = {
  initiativeQueue: CombatActorEntry[];
  isGmViewer: boolean;
  renderStatusBadges: (effects: Array<SessionEffect | SessionMonsterEffect>) => ReactNode;
  onToggleHpPanel: (panelKey: string) => void;
};

export function CombatTurnGrid({
  initiativeQueue,
  isGmViewer,
  renderStatusBadges,
  onToggleHpPanel,
}: CombatTurnGridProps) {
  return (
    <div className="combat-turn-grid">
      {initiativeQueue.map((entry) => {
        const panelKey = `${entry.kind}:${entry.id}`;

        return (
          <div className={`combat-actor-card combat-turn-card ${entry.kind === 'character' ? 'combat-actor-character' : 'combat-actor-monster'} ${entry.isActive ? 'active-turn' : ''}`} key={`initiative-${entry.kind}-${entry.id}`}>
            <div className="combat-actor-namebar">{entry.name}</div>
            {entry.kind === 'monster' && entry.iconUrl ? (
              <img className="combat-actor-image" src={entry.iconUrl} alt={entry.name} />
            ) : (
              <div className="combat-actor-icon">{entry.avatarText}</div>
            )}
            <div className="combat-actor-vitals-row">
              {isGmViewer ? (
                <button
                  className="btn btn-inline combat-hp-toggle"
                  onClick={() => onToggleHpPanel(panelKey)}
                >
                  ❤️ {entry.currentHp} / {entry.maxHp ?? '—'}
                </button>
              ) : (
                <div className="combat-actor-stat">❤️ {entry.currentHp} / {entry.maxHp ?? '—'}</div>
              )}
              <div className="combat-actor-stat">🛡 {entry.armorClass ?? '—'}</div>
            </div>
            <div className="combat-actor-status-row">
              <div className="character-tile-statuses">{renderStatusBadges(entry.effects || [])}</div>
              <div className="combat-actor-stat">🎲 {entry.initiative}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
