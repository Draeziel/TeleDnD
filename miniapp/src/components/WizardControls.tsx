import React from 'react';

type Props = {
  step: number;
  total: number;
  onNext?: () => void;
  onPrev?: () => void;
};

export const WizardControls: React.FC<Props> = ({ step, total, onNext, onPrev }) => {
  return (
    <div className="wizard-controls">
      <div className="wizard-progress" aria-live="polite">Шаг {step + 1} из {total}</div>
      <div className="wizard-actions">
        <button onClick={onPrev} disabled={step === 0} aria-label="Перейти на предыдущий шаг">Назад</button>
        <button onClick={onNext} disabled={step >= total - 1} aria-label="Перейти на следующий шаг">Далее</button>
      </div>
    </div>
  );
};

export default WizardControls;
