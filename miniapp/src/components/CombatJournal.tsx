import { StatusBox } from './StatusBox';
import type { SessionEvent } from '../types/models';

type UiJournalEntry = {
  id: string;
  message: string;
  createdAt: string;
};

type CombatJournalProps = {
  showEvents: boolean;
  onToggle: () => void;
  combatEvents: SessionEvent[];
  interactionUiJournal: UiJournalEntry[];
  getCombatEventDetails: (event: SessionEvent) => string[];
};

function extractStatusApplySummary(event: SessionEvent): { targetName: string; statusName: string } | null {
  if (event.type !== 'effect_applied' && event.type !== 'monster_effect_applied') {
    return null;
  }

  const match = event.message.match(/^Эффект\s+(.+?)\s+примен(?:ё|е)н\s+к(?:\s+монстру)?\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    statusName: match[1].trim(),
    targetName: match[2].trim(),
  };
}

function buildCompactDamageFormula(payload?: Record<string, unknown> | null): string {
  const damage = payload?.damage && typeof payload.damage === 'object'
    ? payload.damage as Record<string, unknown>
    : null;

  if (!damage) {
    return 'урон';
  }

  const mode = String(damage.mode || '').toLowerCase();
  if (mode === 'flat') {
    const value = Number(damage.value || 0);
    return Number.isFinite(value) ? String(value) : 'урон';
  }

  if (mode === 'dice') {
    const count = Number(damage.count || 1);
    const sides = Number(damage.sides || 6);
    const bonus = Number(damage.bonus || 0);
    const bonusPart = bonus === 0 ? '' : bonus > 0 ? `+${bonus}` : `${bonus}`;
    return `${count}d${sides}${bonusPart}`;
  }

  return 'урон';
}

function extractAutoTickSummary(event: SessionEvent): { targetName: string; statusName: string; formula: string } | null {
  if (event.type !== 'effect_auto_tick' && event.type !== 'monster_effect_auto_tick') {
    return null;
  }

  const match = event.message.match(/^Авто-тик\s+(.+?):\s+(.+?)\s+получает\s+\d+\s+урона/i);
  if (!match) {
    return null;
  }

  return {
    statusName: match[1].trim(),
    targetName: match[2].trim(),
    formula: buildCompactDamageFormula(event.payload),
  };
}

export function CombatJournal({
  showEvents,
  onToggle,
  combatEvents,
  interactionUiJournal,
  getCombatEventDetails,
}: CombatJournalProps) {
  return (
    <div className="section-card">
      <div className="session-list-header">
        <h2>Журнал боя</h2>
        <button className="btn btn-secondary btn-compact" onClick={onToggle}>
          {showEvents ? 'Скрыть' : 'Показать'}
        </button>
      </div>
      <p className="meta-row">Подробности бросков и расчётов урона. По умолчанию скрыт.</p>
      {showEvents && (
        (combatEvents.length + interactionUiJournal.length) === 0 ? (
          <StatusBox type="info" message="Боевых событий пока нет" />
        ) : (
          <div className="list-grid combat-journal-list">
            {interactionUiJournal.map((entry) => (
              <div className="list-item combat-journal-item" key={`ui-${entry.id}`}>
                <div className="combat-journal-main">
                  <strong className="combat-journal-primary">{entry.message}</strong>
                  <div className="combat-journal-meta">Кто: интерфейс</div>
                </div>
                <span className="combat-journal-time">{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
            {combatEvents.map((event) => {
              const applySummary = extractStatusApplySummary(event);
              const autoTickSummary = extractAutoTickSummary(event);
              const details = getCombatEventDetails(event);

              return (
                <div className="list-item combat-journal-item" key={event.id}>
                  <div className="combat-journal-main">
                    {applySummary ? (
                      <>
                        <strong className="combat-journal-primary">{`${applySummary.targetName} · ${applySummary.statusName} · ${event.actorTelegramId}`}</strong>
                      </>
                    ) : autoTickSummary ? (
                      <strong className="combat-journal-primary">{`${autoTickSummary.targetName} получает урон от ${autoTickSummary.statusName}: ${autoTickSummary.formula}`}</strong>
                    ) : (
                      <>
                        <strong className="combat-journal-primary">{event.message}</strong>
                        <div className="combat-journal-meta">Кто: {event.actorTelegramId}</div>
                        {details.map((detail, index) => (
                          <div className="combat-journal-meta" key={`${event.id}-detail-${index}`}>{detail}</div>
                        ))}
                      </>
                    )}
                  </div>
                  <span className="combat-journal-time">{new Date(event.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
