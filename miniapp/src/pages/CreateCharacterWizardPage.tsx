import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { characterApi } from '../api/characterApi';
import { draftApi } from '../api/draftApi';
import type { AbilityScorePayload } from '../api/draftApi';
import type { ContentEntity, DraftState } from '../types/models';
import { StatusBox } from '../components/StatusBox';
import { SectionCard } from '../components/SectionCard';

const STEPS = [
  'Имя персонажа',
  'Класс',
  'Раса',
  'Предыстория',
  'Характеристики',
  'Выборы + завершение',
];

const INITIAL_SCORES: AbilityScorePayload = {
  method: 'standard_array',
  str: 15,
  dex: 14,
  con: 13,
  int: 12,
  wis: 10,
  cha: 8,
};

export function CreateCharacterWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [classes, setClasses] = useState<ContentEntity[]>([]);
  const [races, setRaces] = useState<ContentEntity[]>([]);
  const [backgrounds, setBackgrounds] = useState<ContentEntity[]>([]);
  const [scores, setScores] = useState<AbilityScorePayload>(INITIAL_SCORES);
  const [choiceSelections, setChoiceSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [classesData, racesData, backgroundsData] = await Promise.all([
          characterApi.getClasses(),
          characterApi.getRaces(),
          characterApi.getBackgrounds(),
        ]);
        setClasses(classesData);
        setRaces(racesData);
        setBackgrounds(backgroundsData);
      } catch {
        setError('Не удалось загрузить справочники классов/рас/фонов.');
      }
    };

    loadRefs();
  }, []);

  const selectedChoiceSet = useMemo(() => {
    const selectedChoices = Array.isArray(draft?.selectedChoices)
      ? draft.selectedChoices
      : [];
    return new Set(selectedChoices.map((item) => item.choiceId));
  }, [draft]);

  const createDraft = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите имя персонажа.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const created = await draftApi.createDraft(name.trim());
      const freshDraft = await draftApi.getDraft(created.id);
      setDraft(freshDraft);
      setStep(1);
    } catch {
      setError('Не удалось создать черновик.');
    } finally {
      setLoading(false);
    }
  };

  const refreshDraft = async (draftId: string) => {
    const fresh = await draftApi.getDraft(draftId);
    setDraft(fresh);
  };

  const assignClass = async (classId: string) => {
    if (!draft) return;

    try {
      setLoading(true);
      setError('');
      const updated = await draftApi.setClass(draft.id, classId);
      setDraft(updated);
      setStep(2);
    } catch {
      setError('Не удалось установить класс.');
    } finally {
      setLoading(false);
    }
  };

  const assignRace = async (raceId: string | null) => {
    if (!draft) return;

    try {
      setLoading(true);
      setError('');
      if (raceId) {
        const updated = await draftApi.setRace(draft.id, raceId);
        setDraft(updated);
      }
      setStep(3);
    } catch {
      setError('Не удалось установить расу.');
    } finally {
      setLoading(false);
    }
  };

  const assignBackground = async (backgroundId: string | null) => {
    if (!draft) return;

    try {
      setLoading(true);
      setError('');
      if (backgroundId) {
        const updated = await draftApi.setBackground(draft.id, backgroundId);
        setDraft(updated);
      }
      setStep(4);
    } catch {
      setError('Не удалось установить предысторию.');
    } finally {
      setLoading(false);
    }
  };

  const submitScores = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    try {
      setLoading(true);
      setError('');
      const updated = await draftApi.setAbilityScores(draft.id, {
        ...scores,
        str: Number(scores.str),
        dex: Number(scores.dex),
        con: Number(scores.con),
        int: Number(scores.int),
        wis: Number(scores.wis),
        cha: Number(scores.cha),
      });
      setDraft(updated);
      await refreshDraft(draft.id);
      setStep(5);
    } catch {
      setError('Не удалось сохранить характеристики.');
    } finally {
      setLoading(false);
    }
  };

  const saveChoice = async (choiceId: string) => {
    if (!draft) return;
    const selectedOption = choiceSelections[choiceId];

    if (!selectedOption) {
      setError('Выберите вариант перед сохранением выбора.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const updated = await draftApi.saveChoice(draft.id, choiceId, selectedOption);
      setDraft(updated);
      await refreshDraft(draft.id);
    } catch {
      setError('Не удалось сохранить выбор.');
    } finally {
      setLoading(false);
    }
  };

  const finalize = async () => {
    if (!draft) return;

    if (draft.missingChoices.length > 0) {
      setError('Завершение недоступно: остались незаполненные выборы.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await draftApi.finalizeDraft(draft.id);
      setSuccess(`Персонаж создан: ${result.character.name}`);
      navigate(`/character/${result.characterId}`);
    } catch {
      setError('Не удалось завершить черновик.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="toolbar">
        <button onClick={() => navigate('/')}>← Назад к персонажам</button>
      </div>

      <SectionCard title="Мастер создания персонажа">
        <div className="steps">{STEPS.map((s, idx) => <span key={s} className={idx === step ? 'step active' : 'step'}>{idx + 1}. {s}</span>)}</div>
      </SectionCard>

      {loading && <StatusBox type="info" message="Выполняется запрос..." />}
      {error && <StatusBox type="error" message={error} />}
      {success && <StatusBox type="success" message={success} />}

      {step === 0 && (
        <SectionCard title="Шаг 1: Имя и создание черновика">
          <form onSubmit={createDraft} className="form-stack">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя персонажа" />
            <button type="submit">Создать черновик</button>
          </form>
        </SectionCard>
      )}

      {step === 1 && draft && (
        <SectionCard title="Шаг 2: Выбор класса">
          <div className="list-grid">
            {classes.map((item) => (
              <div key={item.id} className="list-item">
                <div>{item.name}</div>
                <button onClick={() => assignClass(item.id)}>Выбрать</button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {step === 2 && draft && (
        <SectionCard title="Шаг 3: Выбор расы">
          <div className="toolbar">
            <button onClick={() => assignRace(null)}>Пропустить расу</button>
          </div>
          <div className="list-grid">
            {races.map((item) => (
              <div key={item.id} className="list-item">
                <div>{item.name}</div>
                <button onClick={() => assignRace(item.id)}>Выбрать</button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {step === 3 && draft && (
        <SectionCard title="Шаг 4: Выбор предыстории">
          <div className="toolbar">
            <button onClick={() => assignBackground(null)}>Пропустить предысторию</button>
          </div>
          <div className="list-grid">
            {backgrounds.map((item) => (
              <div key={item.id} className="list-item">
                <div>{item.name}</div>
                <button onClick={() => assignBackground(item.id)}>Выбрать</button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {step === 4 && draft && (
        <SectionCard title="Шаг 5: Распределение характеристик">
          <form onSubmit={submitScores} className="form-stack">
            <label>
              Метод
              <select
                value={scores.method}
                onChange={(e) => setScores((prev) => ({ ...prev, method: e.target.value as AbilityScorePayload['method'] }))}
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
                    onChange={(e) =>
                      setScores((prev) => ({
                        ...prev,
                        [ability]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <button type="submit">Сохранить характеристики</button>
          </form>
        </SectionCard>
      )}

      {step === 5 && draft && (
        <SectionCard title="Шаг 6: Выборы и завершение">
          {(Array.isArray(draft.requiredChoices) ? draft.requiredChoices : []).length === 0 && <div>Обязательные выборы отсутствуют.</div>}

          {(Array.isArray(draft.requiredChoices) ? draft.requiredChoices : []).map((choice) => {
            const selectedValue = choiceSelections[choice.id] || '';
            const alreadySaved = selectedChoiceSet.has(choice.id);
            const options = Array.isArray(choice.options) ? choice.options : [];

            return (
              <div key={choice.id} className="choice-block">
                <div className="choice-title">
                  Выбор {choice.id} · источник: {choice.sourceType} · нужно выбрать: {choice.chooseCount}
                </div>
                <div className="choice-options">
                  {options.map((option) => (
                    <label key={option.id}>
                      <input
                        type="radio"
                        name={`choice-${choice.id}`}
                        value={option.id}
                        checked={selectedValue === option.id}
                        onChange={(e) =>
                          setChoiceSelections((prev) => ({
                            ...prev,
                            [choice.id]: e.target.value,
                          }))
                        }
                      />
                      {option.name} {option.description ? `(${option.description})` : ''}
                    </label>
                  ))}
                </div>
                <div className="inline-row">
                  <button onClick={() => saveChoice(choice.id)}>Сохранить выбор</button>
                  <span>{alreadySaved ? 'Сохранено' : 'Не сохранено'}</span>
                </div>
              </div>
            );
          })}

          <div className="finalize-box">
            <div>Осталось выборов: {draft.missingChoices.length}</div>
            <button onClick={finalize} disabled={draft.missingChoices.length > 0 || loading}>
              Завершить черновик
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
