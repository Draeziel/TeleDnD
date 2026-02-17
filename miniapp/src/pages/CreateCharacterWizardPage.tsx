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
  'Background',
  'Ability Scores',
  'Choices + Finalize',
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
      setError('Не удалось создать draft.');
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
      setError('Не удалось установить background.');
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
      setError('Не удалось сохранить ability scores.');
    } finally {
      setLoading(false);
    }
  };

  const saveChoice = async (choiceId: string) => {
    if (!draft) return;
    const selectedOption = choiceSelections[choiceId];

    if (!selectedOption) {
      setError('Выберите option перед сохранением choice.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const updated = await draftApi.saveChoice(draft.id, choiceId, selectedOption);
      setDraft(updated);
      await refreshDraft(draft.id);
    } catch {
      setError('Не удалось сохранить choice.');
    } finally {
      setLoading(false);
    }
  };

  const finalize = async () => {
    if (!draft) return;

    if (draft.missingChoices.length > 0) {
      setError('Finalize недоступен: остались missingChoices.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await draftApi.finalizeDraft(draft.id);
      setSuccess(`Character created: ${result.character.name}`);
      navigate(`/character/${result.characterId}`);
    } catch {
      setError('Не удалось finalize draft.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="toolbar">
        <button onClick={() => navigate('/')}>← Back to characters</button>
      </div>

      <SectionCard title="Create Character Wizard">
        <div className="steps">{STEPS.map((s, idx) => <span key={s} className={idx === step ? 'step active' : 'step'}>{idx + 1}. {s}</span>)}</div>
      </SectionCard>

      {loading && <StatusBox type="info" message="Выполняется запрос..." />}
      {error && <StatusBox type="error" message={error} />}
      {success && <StatusBox type="success" message={success} />}

      {step === 0 && (
        <SectionCard title="Step 1: Имя и создание draft">
          <form onSubmit={createDraft} className="form-stack">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя персонажа" />
            <button type="submit">Create Draft</button>
          </form>
        </SectionCard>
      )}

      {step === 1 && draft && (
        <SectionCard title="Step 2: Выбор класса">
          <div className="list-grid">
            {classes.map((item) => (
              <div key={item.id} className="list-item">
                <div>{item.name}</div>
                <button onClick={() => assignClass(item.id)}>Select</button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {step === 2 && draft && (
        <SectionCard title="Step 3: Выбор расы">
          <div className="toolbar">
            <button onClick={() => assignRace(null)}>Skip Race</button>
          </div>
          <div className="list-grid">
            {races.map((item) => (
              <div key={item.id} className="list-item">
                <div>{item.name}</div>
                <button onClick={() => assignRace(item.id)}>Select</button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {step === 3 && draft && (
        <SectionCard title="Step 4: Выбор background">
          <div className="toolbar">
            <button onClick={() => assignBackground(null)}>Skip Background</button>
          </div>
          <div className="list-grid">
            {backgrounds.map((item) => (
              <div key={item.id} className="list-item">
                <div>{item.name}</div>
                <button onClick={() => assignBackground(item.id)}>Select</button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {step === 4 && draft && (
        <SectionCard title="Step 5: Ability score assignment">
          <form onSubmit={submitScores} className="form-stack">
            <label>
              Method
              <select
                value={scores.method}
                onChange={(e) => setScores((prev) => ({ ...prev, method: e.target.value as AbilityScorePayload['method'] }))}
              >
                <option value="standard_array">standard_array</option>
                <option value="point_buy">point_buy</option>
                <option value="manual">manual</option>
                <option value="roll">roll</option>
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
            <button type="submit">Save Ability Scores</button>
          </form>
        </SectionCard>
      )}

      {step === 5 && draft && (
        <SectionCard title="Step 6: Choices + Finalize">
          {(Array.isArray(draft.requiredChoices) ? draft.requiredChoices : []).length === 0 && <div>Required choices отсутствуют.</div>}

          {(Array.isArray(draft.requiredChoices) ? draft.requiredChoices : []).map((choice) => {
            const selectedValue = choiceSelections[choice.id] || '';
            const alreadySaved = selectedChoiceSet.has(choice.id);
            const options = Array.isArray(choice.options) ? choice.options : [];

            return (
              <div key={choice.id} className="choice-block">
                <div className="choice-title">
                  Choice {choice.id} · source: {choice.sourceType} · chooseCount: {choice.chooseCount}
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
                  <button onClick={() => saveChoice(choice.id)}>Save choice</button>
                  <span>{alreadySaved ? 'Saved' : 'Not saved'}</span>
                </div>
              </div>
            );
          })}

          <div className="finalize-box">
            <div>Missing choices: {draft.missingChoices.length}</div>
            <button onClick={finalize} disabled={draft.missingChoices.length > 0 || loading}>
              Finalize Draft
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
