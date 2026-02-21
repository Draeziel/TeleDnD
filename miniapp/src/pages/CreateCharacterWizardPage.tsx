import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { characterApi } from '../api/characterApi';
import { draftApi } from '../api/draftApi';
import type { AbilityScorePayload } from '../api/draftApi';
import type { ContentEntity, DraftState } from '../types/models';
import { StatusBox } from '../components/StatusBox';
import { SectionCard } from '../components/SectionCard';
import { WizardControls } from '../components/WizardControls';
import { StepBasicInfo } from './wizard/StepBasicInfo';
import { StepClassRaceBackground } from './wizard/StepClassRaceBackground';
import { StepAbilityScores } from './wizard/StepAbilityScores';
import { StepChoicesFinalize } from './wizard/StepChoicesFinalize';
import { StepEquipment } from './wizard/StepEquipment';

const STEPS = [
  'Имя персонажа',
  'Класс / Раса / Предыстория',
  'Характеристики',
  'Снаряжение',
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

  // selectedChoiceSet was moved to choices component; remove unused local variable

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
      setStep(2);
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
      setStep(2);
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
      setStep(3);
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
        <WizardControls step={step} total={STEPS.length} onNext={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} onPrev={() => setStep((s) => Math.max(0, s - 1))} />
      </SectionCard>

      {loading && <StatusBox type="info" message="Выполняется запрос..." />}
      {error && <StatusBox type="error" message={error} />}
      {success && <StatusBox type="success" message={success} />}

      {step === 0 && (
        <SectionCard title="Шаг 1: Имя и создание черновика">
          <StepBasicInfo name={name} onNameChange={setName} onCreateDraft={createDraft} loading={loading} error={error} />
        </SectionCard>
      )}

      {step === 1 && (
        <SectionCard title="Шаги: Класс / Раса / Предыстория">
          <StepClassRaceBackground
            draft={draft}
            classes={classes}
            races={races}
            backgrounds={backgrounds}
            onAssignClass={assignClass}
            onAssignRace={assignRace}
            onAssignBackground={assignBackground}
          />
        </SectionCard>
      )}

      {step === 2 && (
        <SectionCard title="Шаг: Характеристики">
          <StepAbilityScores scores={scores} onChange={(updater) => setScores(updater)} onSubmit={submitScores} loading={loading} />
        </SectionCard>
      )}

      {step === 3 && (
        <SectionCard title="Шаг: Снаряжение">
          <StepEquipment
            draft={draft}
            choiceSelections={choiceSelections}
            setChoiceSelection={(choiceId: string, optionId: string) => setChoiceSelections((prev) => ({ ...prev, [choiceId]: optionId }))}
            onSaveChoice={saveChoice}
            loading={loading}
            // pass refresh so equipment step can reload draft after add/equip
            refreshDraft={refreshDraft}
          />
        </SectionCard>
      )}

      {step === 4 && (
        <SectionCard title="Шаг: Выборы и завершение">
          <StepChoicesFinalize
            draft={draft}
            choiceSelections={choiceSelections}
            setChoiceSelection={(choiceId: string, optionId: string) => setChoiceSelections((prev) => ({ ...prev, [choiceId]: optionId }))}
            onSaveChoice={saveChoice}
            onFinalize={finalize}
            loading={loading}
          />
        </SectionCard>
      )}
    </div>
  );
}
