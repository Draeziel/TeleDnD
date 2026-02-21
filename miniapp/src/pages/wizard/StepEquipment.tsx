import React from 'react';
import type { DraftState } from '../../types/models';
import { SectionCard } from '../../components/SectionCard';

interface Props {
  draft: DraftState | null;
}

export const StepEquipment: React.FC<Props> = ({ draft }) => {
  if (!draft) {
    return (
      <SectionCard title="Снаряжение">
        <div>Сначала создайте черновик персонажа.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Снаряжение">
      <div>
        <p>Выбор и управление снаряжением пока доступны для созданного персонажа.</p>
        <p>Завершите черновик, чтобы добавить предметы и экипировать их.</p>
      </div>
    </SectionCard>
  );
};

export default StepEquipment;
