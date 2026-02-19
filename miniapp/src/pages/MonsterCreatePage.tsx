import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { monsterApi } from '../api/monsterApi';
import { StatusBox } from '../components/StatusBox';

export function MonsterCreatePage() {
  const { monsterId } = useParams<{ monsterId: string }>();
  const isEditMode = Boolean(monsterId);
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [loadingMonster, setLoadingMonster] = useState(isEditMode);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [size, setSize] = useState('Большой');
  const [creatureType, setCreatureType] = useState('небожитель');
  const [alignment, setAlignment] = useState('законно-добрый');
  const [armorClass, setArmorClass] = useState(12);
  const [maxHp, setMaxHp] = useState(10);
  const [hitDice, setHitDice] = useState('');
  const [speed, setSpeed] = useState('30 фт.');
  const [strength, setStrength] = useState(10);
  const [dexterity, setDexterity] = useState(10);
  const [constitution, setConstitution] = useState(10);
  const [intelligence, setIntelligence] = useState(10);
  const [wisdom, setWisdom] = useState(10);
  const [charisma, setCharisma] = useState(10);
  const [initiativeModifier, setInitiativeModifier] = useState(0);
  const [challengeRating, setChallengeRating] = useState('');
  const [damageImmunities, setDamageImmunities] = useState('');
  const [conditionImmunities, setConditionImmunities] = useState('');
  const [senses, setSenses] = useState('');
  const [languages, setLanguages] = useState('');
  const [traits, setTraits] = useState('');
  const [actions, setActions] = useState('');
  const [legendaryActions, setLegendaryActions] = useState('');
  const [source, setSource] = useState('');
  const [templateScope, setTemplateScope] = useState<'GLOBAL' | 'PERSONAL'>('PERSONAL');

  useEffect(() => {
    if (!monsterId) {
      setLoadingMonster(false);
      return;
    }

    const loadMonster = async () => {
      try {
        setLoadingMonster(true);
        setError('');

        const payload = await monsterApi.listTemplates({ scope: 'all' });
        const template = payload.items.find((item) => item.id === monsterId);

        if (!template) {
          setError('Шаблон монстра не найден');
          return;
        }

        setName(template.name);
        setIconUrl(template.iconUrl || '');
        setImageUrl(template.imageUrl || '');
        setSize(template.size || '');
        setCreatureType(template.creatureType || '');
        setAlignment(template.alignment || '');
        setArmorClass(template.armorClass);
        setMaxHp(template.maxHp);
        setHitDice(template.hitDice || '');
        setSpeed(template.speed || '');
        setStrength(template.strength);
        setDexterity(template.dexterity);
        setConstitution(template.constitution);
        setIntelligence(template.intelligence);
        setWisdom(template.wisdom);
        setCharisma(template.charisma);
        setInitiativeModifier(template.initiativeModifier);
        setChallengeRating(template.challengeRating || '');
        setDamageImmunities(template.damageImmunities || '');
        setConditionImmunities(template.conditionImmunities || '');
        setSenses(template.senses || '');
        setLanguages(template.languages || '');
        setTraits(template.traits || '');
        setActions(template.actions || '');
        setLegendaryActions(template.legendaryActions || '');
        setSource(template.source || '');
        setTemplateScope(template.scope);
      } catch {
        setError('Не удалось загрузить шаблон монстра');
      } finally {
        setLoadingMonster(false);
      }
    };

    loadMonster();
  }, [monsterId]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setCreating(true);
      setError('');

      const input = {
        name,
        iconUrl,
        imageUrl,
        size,
        creatureType,
        alignment,
        armorClass,
        maxHp,
        hitDice,
        speed,
        strength,
        dexterity,
        constitution,
        intelligence,
        wisdom,
        charisma,
        initiativeModifier,
        challengeRating,
        damageImmunities,
        conditionImmunities,
        senses,
        languages,
        traits,
        actions,
        legendaryActions,
        source,
        scope: templateScope,
      };

      if (monsterId) {
        await monsterApi.updateTemplate(monsterId, input);
      } else {
        await monsterApi.createTemplate(input);
      }

      navigate('/monsters');
    } catch {
      setError(monsterId ? 'Не удалось обновить шаблон монстра' : 'Не удалось создать шаблон монстра');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="section-card">
        <h2>{isEditMode ? 'Редактировать монстра' : 'Создать монстра'}</h2>
        <p className="meta-row">После сохранения вернёмся в список монстров.</p>
        <Link className="btn btn-secondary" to="/monsters">Назад к списку</Link>
      </div>

      {error && <StatusBox type="error" message={error} />}

      <div className="section-card">
        {loadingMonster ? (
          <StatusBox type="info" message="Загрузка шаблона..." />
        ) : (
        <form className="form-stack" onSubmit={onCreate}>
          <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Название монстра" minLength={2} maxLength={80} />
          <div className="grid-2">
            <input value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} placeholder="URL иконки" maxLength={500} />
            <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="URL изображения" maxLength={500} />
          </div>
          <div className="grid-3">
            <input value={size} onChange={(event) => setSize(event.target.value)} placeholder="Размер" maxLength={40} />
            <input value={creatureType} onChange={(event) => setCreatureType(event.target.value)} placeholder="Тип" maxLength={60} />
            <input value={alignment} onChange={(event) => setAlignment(event.target.value)} placeholder="Мировоззрение" maxLength={60} />
          </div>
          <div className="grid-3">
            <label>AC<input type="number" value={armorClass} onChange={(event) => setArmorClass(Number(event.target.value) || 0)} min={0} max={40} /></label>
            <label>HP<input type="number" value={maxHp} onChange={(event) => setMaxHp(Number(event.target.value) || 1)} min={1} max={9999} /></label>
            <input value={hitDice} onChange={(event) => setHitDice(event.target.value)} placeholder="Кости хитов" maxLength={40} />
          </div>
          <div className="grid-2">
            <input value={speed} onChange={(event) => setSpeed(event.target.value)} placeholder="Скорость" maxLength={60} />
            <label>Иниц. мод<input type="number" value={initiativeModifier} onChange={(event) => setInitiativeModifier(Number(event.target.value) || 0)} min={-20} max={20} /></label>
          </div>
          <div className="grid-3">
            <label>СИЛ<input type="number" min={1} max={30} value={strength} onChange={(event) => setStrength(Number(event.target.value) || 10)} /></label>
            <label>ЛОВ<input type="number" min={1} max={30} value={dexterity} onChange={(event) => setDexterity(Number(event.target.value) || 10)} /></label>
            <label>ТЕЛ<input type="number" min={1} max={30} value={constitution} onChange={(event) => setConstitution(Number(event.target.value) || 10)} /></label>
          </div>
          <div className="grid-3">
            <label>ИНТ<input type="number" min={1} max={30} value={intelligence} onChange={(event) => setIntelligence(Number(event.target.value) || 10)} /></label>
            <label>МДР<input type="number" min={1} max={30} value={wisdom} onChange={(event) => setWisdom(Number(event.target.value) || 10)} /></label>
            <label>ХАР<input type="number" min={1} max={30} value={charisma} onChange={(event) => setCharisma(Number(event.target.value) || 10)} /></label>
          </div>
          <div className="grid-2">
            <input value={challengeRating} onChange={(event) => setChallengeRating(event.target.value)} placeholder="CR" maxLength={20} />
            <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Источник" maxLength={80} />
          </div>
          <input value={damageImmunities} onChange={(event) => setDamageImmunities(event.target.value)} placeholder="Иммунитеты к урону" maxLength={200} />
          <input value={conditionImmunities} onChange={(event) => setConditionImmunities(event.target.value)} placeholder="Иммунитеты к состояниям" maxLength={200} />
          <input value={senses} onChange={(event) => setSenses(event.target.value)} placeholder="Чувства" maxLength={200} />
          <input value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="Языки" maxLength={200} />
          <textarea value={traits} onChange={(event) => setTraits(event.target.value)} placeholder="Особенности" rows={4} maxLength={4000} />
          <textarea value={actions} onChange={(event) => setActions(event.target.value)} placeholder="Действия" rows={4} maxLength={4000} />
          <textarea value={legendaryActions} onChange={(event) => setLegendaryActions(event.target.value)} placeholder="Легендарные действия" rows={3} maxLength={4000} />
          <button className="btn btn-primary" disabled={creating} type="submit">
            {creating ? (isEditMode ? 'Сохраняем...' : 'Создаём...') : (isEditMode ? 'Сохранить' : 'Создать')}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
