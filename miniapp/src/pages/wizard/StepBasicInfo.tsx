import React from 'react';
import type { FormEvent } from 'react';

type Props = {
  name: string;
  onNameChange: (v: string) => void;
  onCreateDraft: (e: FormEvent) => void;
  loading?: boolean;
  error?: string;
};

export const StepBasicInfo: React.FC<Props> = ({ name, onNameChange, onCreateDraft, loading, error }) => {
  return (
    <div>
      <form onSubmit={onCreateDraft} className="form-stack">
        <label htmlFor="character-name-input">Имя персонажа</label>
        <input
          id="character-name-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Имя персонажа"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'character-name-error' : undefined}
        />
        <button type="submit" disabled={loading}>Создать черновик</button>
      </form>
      {error && <div id="character-name-error" className="helper error" role="alert">{error}</div>}
    </div>
  );
};

export default StepBasicInfo;
