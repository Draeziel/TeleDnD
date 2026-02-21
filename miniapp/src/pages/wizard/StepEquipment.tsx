import React, { useEffect, useState } from 'react';
import type { DraftState, DraftChoice } from '../../types/models';
import { characterApi } from '../../api/characterApi';
import { draftApi } from '../../api/draftApi';

type Props = {
  draft: DraftState | null;
  choiceSelections: Record<string, string>;
  setChoiceSelection: (choiceId: string, optionId: string) => void;
  onSaveChoice: (choiceId: string) => Promise<void>;
  loading?: boolean;
};

export const StepEquipment: React.FC<Props> = ({ draft, choiceSelections, setChoiceSelection, onSaveChoice, loading }) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const items = await characterApi.getItems();
        setTemplates(items);
      } catch {
        setTemplates([]);
      }
    };

    load();
  }, []);

  if (!draft) return null;

  const equipmentChoices: DraftChoice[] = (Array.isArray(draft.requiredChoices) ? draft.requiredChoices : []).filter((c) => c.sourceType === 'equipment' || c.sourceType === 'starting_equipment');

  const draftItems = Array.isArray((draft as any).draftItems) ? (draft as any).draftItems : [];

  const handleAdd = async (itemId: string) => {
    if (!draft) return;
    setAdding(itemId);
    try {
      await draftApi.addItem(draft.id, itemId);
      const fresh = await draftApi.getDraft(draft.id);
      // update parent by emitting an event or relying on parent refresh; here we'll attempt to update window state if available
      // parent CreateCharacterWizardPage refreshes draft after saves — rely on that for now
    } finally {
      setAdding(null);
    }
  };

  const handleEquip = async (itemId: string) => {
    if (!draft) return;
    try {
      await draftApi.equipItem(draft.id, itemId);
    } finally {
      // rely on parent refresh
    }
  };

  const handleUnequip = async (itemId: string) => {
    if (!draft) return;
    try {
      await draftApi.unequipItem(draft.id, itemId);
    } finally {
      // rely on parent refresh
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h4>Доступные предметы</h4>
        {templates.length === 0 && <div>Справочник предметов пуст.</div>}
        {templates.map((t) => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div>
              <strong>{t.name}</strong> {t.slot ? <em>· слот: {t.slot}</em> : null}
              <div style={{ fontSize: 12 }}>{t.description}</div>
            </div>
            <div>
              <button onClick={() => handleAdd(t.id)} disabled={adding === t.id}>{adding === t.id ? 'Добавление...' : 'Добавить в черновик'}</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Предметы в черновике</h4>
        {draftItems.length === 0 && <div>Нет добавленных предметов.</div>}
        {draftItems.map((di: any) => (
          <div key={di.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div>
              <strong>{di.item?.name || di.itemId}</strong> {di.item?.slot ? <em>· {di.item.slot}</em> : null}
            </div>
            <div>
              {di.equipped ? (
                <button onClick={() => handleUnequip(di.itemId)}>Снять</button>
              ) : (
                <button onClick={() => handleEquip(di.itemId)}>Экипировать</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {equipmentChoices.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4>Обязательные выборы</h4>
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
      )}
    </div>
  );
};

export default StepEquipment;
