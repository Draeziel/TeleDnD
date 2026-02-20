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
          <div className="list-grid">
            {interactionUiJournal.map((entry) => (
              <div className="list-item" key={`ui-${entry.id}`}>
                <div>
                  <strong>{entry.message}</strong>
                  <div>Кто: интерфейс</div>
                </div>
                <span>{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
            {combatEvents.map((event) => {
              const details = getCombatEventDetails(event);

              return (
                <div className="list-item" key={event.id}>
                  <div>
                    <strong>{event.message}</strong>
                    <div>Кто: {event.actorTelegramId}</div>
                    {details.map((detail, index) => (
                      <div className="meta-row" key={`${event.id}-detail-${index}`}>{detail}</div>
                    ))}
                  </div>
                  <span>{new Date(event.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
