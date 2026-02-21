import React from 'react';
import type { DraftState, DraftChoice } from '../../types/models';

type Props = {
  draft: DraftState | null;
  choiceSelections: Record<string, string>;
  setChoiceSelection: (choiceId: string, optionId: string) => void;
  onSaveChoice: (choiceId: string) => Promise<void>;
  loading?: boolean;
};

export const StepEquipment: React.FC<Props> = ({ draft, choiceSelections, setChoiceSelection, onSaveChoice, loading }) => {
  if (!draft) return null;

  const equipmentChoices: DraftChoice[] = (Array.isArray(draft.requiredChoices) ? draft.requiredChoices : []).filter((c) => c.sourceType === 'equipment' || c.sourceType === 'starting_equipment');

  return (
    <div>
      {equipmentChoices.length === 0 && <div>Нет обязательных выборов снаряжения для этого черновика.</div>}

      {equipmentChoices.map((choice) => {
        const selectedValue = choiceSelections[choice.id] || '';
        const options = Array.isArray(choice.options) ? choice.options : [];

        return (
          <div key={choice.id} className="choice-block">
            <div className="choice-title">Снаряжение · {choice.id} · нужно выбрать: {choice.chooseCount}</div>
            <div className="choice-options">
              {options.map((option) => (
                <label key={option.id} style={{ display: 'block', marginBottom: 6 }}>
                  <input
                    type="radio"
                    name={`choice-${choice.id}`}
                    value={option.id}
                    checked={selectedValue === option.id}
                    onChange={(e) => setChoiceSelection(choice.id, e.target.value)}
                  />
                  {' '}{option.name} {option.description ? `(${option.description})` : ''}
                </label>
              ))}
            </div>
            <div className="inline-row">
              <button onClick={() => onSaveChoice(choice.id)} disabled={loading}>Сохранить выбор снаряжения</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StepEquipment;
