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
        <input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Имя персонажа" />
        <button type="submit" disabled={loading}>Создать черновик</button>
      </form>
      {error && <div className="helper error">{error}</div>}
    </div>
  );
};

export default StepBasicInfo;
