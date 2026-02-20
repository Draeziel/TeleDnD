import type { SessionEffect, SessionMonsterEffect, StatusTemplate } from '../types/models';
import type { CombatActorEntry } from './CombatTypes';

type CombatActorModalProps = {
  entry: CombatActorEntry;
  activeCombatPanelKeyValue: string;
  hasActiveGm: boolean;
  statusTemplates: StatusTemplate[];
  selectedStatusTemplateId: string;
  effectApplyingKey: string | null;
  effectRemovingKey: string | null;
  onClose: () => void;
  onSelectStatusTemplate: (templateId: string) => void;
  onDecreaseHp: () => void;
  onIncreaseHp: () => void;
  onApplyStatus: () => void;
  onRemoveEffect: (effectId: string, effectType: string) => void;
};

export function CombatActorModal({
  entry,
  activeCombatPanelKeyValue,
  hasActiveGm,
  statusTemplates,
  selectedStatusTemplateId,
  effectApplyingKey,
  effectRemovingKey,
  onClose,
  onSelectStatusTemplate,
  onDecreaseHp,
  onIncreaseHp,
  onApplyStatus,
  onRemoveEffect,
}: CombatActorModalProps) {
  return (
    <div className="combat-modal-backdrop" onClick={onClose}>
      <div className="combat-modal" onClick={(event) => event.stopPropagation()}>
        <div className="combat-modal-head">
          <strong>{entry.name}</strong>
          <button className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Закрыть окно">
            ✕
          </button>
        </div>

        <div className="combat-modal-meta">
          ❤️ {entry.currentHp} / {entry.maxHp ?? '—'}
        </div>

        <div className="inline-row">
          <button
            className="btn btn-secondary"
            disabled={!hasActiveGm}
            onClick={onDecreaseHp}
          >
            HP -1
          </button>
          <button
            className="btn btn-secondary"
            disabled={!hasActiveGm}
            onClick={onIncreaseHp}
          >
            HP +1
          </button>
        </div>

        <div className="combat-modal-body">
          <div className="status-preset-row">
            {(entry.effects || []).length === 0 ? (
              <span className="meta-row">Активных статусов нет</span>
            ) : (
              (entry.effects || []).map((effect: SessionEffect | SessionMonsterEffect) => {
                const removeKey = `${activeCombatPanelKeyValue}:${effect.id}`;

                return (
                  <button
                    key={effect.id}
                    className="btn btn-secondary btn-compact"
                    disabled={!hasActiveGm || effectRemovingKey === removeKey}
                    title={`Снять ${effect.effectType}`}
                    onClick={() => onRemoveEffect(effect.id, effect.effectType)}
                  >
                    {effectRemovingKey === removeKey ? 'Снимаем...' : `✕ ${effect.effectType}`}
                  </button>
                );
              })
            )}
          </div>

          <div className="status-preset-row">
            <select
              value={selectedStatusTemplateId}
              disabled={effectApplyingKey === activeCombatPanelKeyValue || !hasActiveGm}
              onChange={(event) => {
                onSelectStatusTemplate(event.target.value);
              }}
            >
              <option value="">Шаблон статуса</option>
              {statusTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.defaultDuration})
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-secondary"
            disabled={effectApplyingKey === activeCombatPanelKeyValue || !hasActiveGm || !selectedStatusTemplateId}
            onClick={onApplyStatus}
          >
            {effectApplyingKey === activeCombatPanelKeyValue ? 'Наложение...' : 'Наложить'}
          </button>
        </div>
      </div>
    </div>
  );
}
