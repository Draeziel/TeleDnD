import React from 'react';
import type { DraftState } from '../../types/models';

type Props = {
  draft: DraftState | null;
  choiceSelections: Record<string, string>;
  setChoiceSelection: (choiceId: string, optionId: string) => void;
  onSaveChoice: (choiceId: string) => Promise<void>;
  onFinalize: () => Promise<void>;
  loading?: boolean;
};

export const StepChoicesFinalize: React.FC<Props> = ({ draft, choiceSelections, setChoiceSelection, onSaveChoice, onFinalize, loading }) => {
  if (!draft) return null;

  return (
    <div>
      {(Array.isArray(draft.requiredChoices) ? draft.requiredChoices : []).length === 0 && <div>Обязательные выборы отсутствуют.</div>}

      {(Array.isArray(draft.requiredChoices) ? draft.requiredChoices : []).map((choice) => {
        const selectedValue = choiceSelections[choice.id] || '';
        const options = Array.isArray(choice.options) ? choice.options : [];

        return (
          <div key={choice.id} className="choice-block" role="group" aria-labelledby={`final-choice-${choice.id}`}>
            <div className="choice-title" id={`final-choice-${choice.id}`}>Выбор {choice.id} · источник: {choice.sourceType} · нужно выбрать: {choice.chooseCount}</div>
            <fieldset className="choice-options">
              <legend style={{ position: 'absolute', left: '-10000px' }}>Выбор варианта для {choice.id}</legend>
              {options.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name={`choice-${choice.id}`}
                    value={option.id}
                    checked={selectedValue === option.id}
                    onChange={(e) => setChoiceSelection(choice.id, e.target.value)}
                  />
                  {option.name} {option.description ? `(${option.description})` : ''}
                </label>
              ))}
            </fieldset>
            <div className="inline-row">
              <button onClick={() => onSaveChoice(choice.id)} aria-label={`Сохранить выбор ${choice.id}`}>Сохранить выбор</button>
            </div>
          </div>
        );
      })}

      <div className="finalize-box">
        <div aria-live="polite">Осталось выборов: {draft.missingChoices.length}</div>
        <button onClick={onFinalize} disabled={draft.missingChoices.length > 0 || loading} aria-label="Завершить создание персонажа">Завершить черновик</button>
      </div>
    </div>
  );
};

export default StepChoicesFinalize;
