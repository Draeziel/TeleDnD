import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepEquipment from './StepEquipment';
import { characterApi } from '../../api/characterApi';
import { draftApi } from '../../api/draftApi';

vi.mock('../../api/characterApi', () => ({
  characterApi: {
    getItems: vi.fn(),
  },
}));

vi.mock('../../api/draftApi', () => ({
  draftApi: {
    addItem: vi.fn(),
    equipItem: vi.fn(),
    unequipItem: vi.fn(),
  },
}));

describe('StepEquipment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads templates and handles add/equip/unequip and save choice', async () => {
    vi.mocked(characterApi.getItems).mockResolvedValue([
      { id: 'item-1', name: 'Longsword', slot: 'weapon', description: 'desc' },
    ] as any);

    vi.mocked(draftApi.addItem).mockResolvedValue({} as any);
    vi.mocked(draftApi.equipItem).mockResolvedValue({} as any);
    vi.mocked(draftApi.unequipItem).mockResolvedValue({} as any);

    const refreshDraft = vi.fn();
    const setChoiceSelection = vi.fn();
    const onSaveChoice = vi.fn().mockResolvedValue(undefined);

    const draft: any = {
      id: 'd1',
      requiredChoices: [
        {
          id: 'choice-equipment-1',
          sourceType: 'equipment',
          chooseCount: 1,
          options: [{ id: 'opt-1', name: 'Shield', description: 'Shield desc' }],
        },
      ],
      draftItems: [
        {
          id: 'di-1',
          itemId: 'item-1',
          equipped: false,
          item: { id: 'item-1', name: 'Longsword', slot: 'weapon' },
        },
        {
          id: 'di-2',
          itemId: 'item-2',
          equipped: true,
          item: { id: 'item-2', name: 'Leather', slot: 'armor' },
        },
      ],
    };

    render(
      <StepEquipment
        draft={draft}
        choiceSelections={{}}
        setChoiceSelection={setChoiceSelection}
        onSaveChoice={onSaveChoice}
        refreshDraft={refreshDraft}
        loading={false}
      />,
    );

    await waitFor(() => {
      expect(characterApi.getItems).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Добавить в черновик' }));
    expect(draftApi.addItem).toHaveBeenCalledWith('d1', 'item-1');
    expect(refreshDraft).toHaveBeenCalledWith('d1');

    await userEvent.click(screen.getByRole('button', { name: 'Экипировать' }));
    expect(draftApi.equipItem).toHaveBeenCalledWith('d1', 'item-1');

    await userEvent.click(screen.getByRole('button', { name: 'Снять' }));
    expect(draftApi.unequipItem).toHaveBeenCalledWith('d1', 'item-2');

    await userEvent.click(screen.getByRole('radio', { name: /Shield/i }));
    expect(setChoiceSelection).toHaveBeenCalledWith('choice-equipment-1', 'opt-1');

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить выбор снаряжения' }));
    expect(onSaveChoice).toHaveBeenCalledWith('choice-equipment-1');
  });
});
