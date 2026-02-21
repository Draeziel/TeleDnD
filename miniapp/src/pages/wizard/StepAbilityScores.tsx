import React from 'react';
import type { FormEvent } from 'react';
import type { AbilityScorePayload } from '../../api/draftApi';

type Props = {
  scores: AbilityScorePayload;
  onChange: (updater: (prev: AbilityScorePayload) => AbilityScorePayload) => void;
  onSubmit: (e: FormEvent) => void;
  loading?: boolean;
};

export const StepAbilityScores: React.FC<Props> = ({ scores, onChange, onSubmit, loading }) => {
  return (
    <div>
      <form onSubmit={onSubmit} className="form-stack">
        <label>
          Метод
          <select
            value={scores.method}
            onChange={(e) => onChange(() => ({ ...scores, method: e.target.value as any }))}
          >
            <option value="standard_array">Стандартный массив</option>
            <option value="point_buy">Покупка очков</option>
            <option value="manual">Ручной ввод</option>
            <option value="roll">Броски</option>
          </select>
        </label>
        <div className="grid-3">
          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => (
            <label key={ability}>
              {ability.toUpperCase()}
              <input
                type="number"
                value={scores[ability]}
                onChange={(e) => onChange((prev) => ({ ...prev, [ability]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        <button type="submit" disabled={loading}>Сохранить характеристики</button>
      </form>
    </div>
  );
};

export default StepAbilityScores;
