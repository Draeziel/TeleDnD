import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { monsterApi } from '../api/monsterApi';
import { StatusBox } from '../components/StatusBox';
import type { MonsterTemplate } from '../types/models';

type MonstersTab = 'PERSONAL' | 'GLOBAL';

export function MonstersPage() {
  const [items, setItems] = useState<MonsterTemplate[]>([]);
  const [canManageGlobal, setCanManageGlobal] = useState(false);
  const [activeTab, setActiveTab] = useState<MonstersTab>('PERSONAL');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

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
  const [scope, setScope] = useState<'PERSONAL' | 'GLOBAL'>('PERSONAL');

  const load = async () => {
    try {
      setLoading(true);
      setError('');

      const payload = await monsterApi.listTemplates({ scope: 'all' });
      setItems(payload.items);
      setCanManageGlobal(payload.canManageGlobal);
      if (!payload.canManageGlobal) {
        setScope('PERSONAL');
        setActiveTab('PERSONAL');
      }
    } catch {
      setError('Не удалось загрузить каталог монстров');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setCreating(true);
      setError('');
      setStatus('');

      const created = await monsterApi.createTemplate({
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
        scope: canManageGlobal ? scope : 'PERSONAL',
      });

      setStatus(`Шаблон "${created.name}" создан`);
      setName('');
      setIconUrl('');
      setImageUrl('');
      setChallengeRating('');
      setSource('');
      setTraits('');
      setActions('');
      setLegendaryActions('');
      await load();
    } catch {
      setError('Не удалось создать шаблон монстра');
    } finally {
      setCreating(false);
    }
  };

  const globalItems = useMemo(() => items.filter((item) => item.scope === 'GLOBAL'), [items]);
  const personalItems = useMemo(() => items.filter((item) => item.scope === 'PERSONAL'), [items]);
  const visibleItems = activeTab === 'PERSONAL' ? personalItems : globalItems;

  const renderCard = (monster: MonsterTemplate) => (
    <div className="monster-card" key={monster.id}>
      <div className="monster-card-media">
        {monster.imageUrl ? (
          <img className="monster-card-image" src={monster.imageUrl} alt={monster.name} />
        ) : (
          <div className="monster-card-image placeholder">Нет изображения</div>
        )}
        <div className="monster-card-icon-wrap">
          {monster.iconUrl ? (
            <img className="monster-card-icon" src={monster.iconUrl} alt={`${monster.name} icon`} />
          ) : (
            <div className="monster-card-icon placeholder">?</div>
          )}
        </div>
      </div>
      <div className="monster-card-body">
        <div className="monster-card-header">
          <strong>{monster.name}</strong>
          <span>{monster.challengeRating || 'CR —'}</span>
        </div>
        <div className="meta-row">{[monster.size, monster.creatureType, monster.alignment].filter(Boolean).join(', ') || '—'}</div>
        <div className="meta-row">AC {monster.armorClass} • HP {monster.maxHp}{monster.hitDice ? ` (${monster.hitDice})` : ''} • Скорость {monster.speed || '—'}</div>
        <div className="meta-row">СИЛ {monster.strength} • ЛОВ {monster.dexterity} • ТЕЛ {monster.constitution} • ИНТ {monster.intelligence} • МДР {monster.wisdom} • ХАР {monster.charisma}</div>
        {(monster.damageImmunities || monster.conditionImmunities || monster.senses || monster.languages) && (
          <div className="meta-row">
            {monster.damageImmunities ? `Урон: ${monster.damageImmunities}. ` : ''}
            {monster.conditionImmunities ? `Состояния: ${monster.conditionImmunities}. ` : ''}
            {monster.senses ? `Чувства: ${monster.senses}. ` : ''}
            {monster.languages ? `Языки: ${monster.languages}.` : ''}
          </div>
        )}
        {monster.traits && <details><summary>Особенности</summary><p>{monster.traits}</p></details>}
        {monster.actions && <details><summary>Действия</summary><p>{monster.actions}</p></details>}
        {monster.legendaryActions && <details><summary>Легендарные действия</summary><p>{monster.legendaryActions}</p></details>}
      </div>
    </div>
  );

  return (
    <div className="page-stack">
      <div className="section-card">
        <h2>Монстры</h2>
        <p className="meta-row">Отдельно: создание шаблона и просмотр каталога. Вкладки — личные и глобальные монстры.</p>
      </div>

      {status && <StatusBox type="success" message={status} />}
      {error && <StatusBox type="error" message={error} />}

      <div className="section-card">
        <h2>Создание монстра</h2>
        <form className="form-stack" onSubmit={onCreate}>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Название монстра"
            minLength={2}
            maxLength={80}
          />
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
            <label>
              AC
              <input
                type="number"
                value={armorClass}
                onChange={(event) => setArmorClass(Number(event.target.value) || 0)}
                min={0}
                max={40}
              />
            </label>
            <label>
              HP
              <input
                type="number"
                value={maxHp}
                onChange={(event) => setMaxHp(Number(event.target.value) || 1)}
                min={1}
                max={9999}
              />
            </label>
            <input value={hitDice} onChange={(event) => setHitDice(event.target.value)} placeholder="Кости хитов (например 9к10+18)" maxLength={40} />
          </div>
          <div className="grid-2">
            <input value={speed} onChange={(event) => setSpeed(event.target.value)} placeholder="Скорость (например 50 фт.)" maxLength={60} />
            <label>
              Иниц. мод
              <input
                type="number"
                value={initiativeModifier}
                onChange={(event) => setInitiativeModifier(Number(event.target.value) || 0)}
                min={-20}
                max={20}
              />
            </label>
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
            <input
              value={challengeRating}
              onChange={(event) => setChallengeRating(event.target.value)}
              placeholder="CR (например 1/4)"
              maxLength={20}
            />
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Источник (например SRD)"
              maxLength={80}
            />
          </div>
          <input value={damageImmunities} onChange={(event) => setDamageImmunities(event.target.value)} placeholder="Иммунитеты к урону" maxLength={200} />
          <input value={conditionImmunities} onChange={(event) => setConditionImmunities(event.target.value)} placeholder="Иммунитеты к состояниям" maxLength={200} />
          <input value={senses} onChange={(event) => setSenses(event.target.value)} placeholder="Чувства" maxLength={200} />
          <input value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="Языки" maxLength={200} />
          <textarea value={traits} onChange={(event) => setTraits(event.target.value)} placeholder="Особенности" rows={4} maxLength={4000} />
          <textarea value={actions} onChange={(event) => setActions(event.target.value)} placeholder="Действия" rows={4} maxLength={4000} />
          <textarea value={legendaryActions} onChange={(event) => setLegendaryActions(event.target.value)} placeholder="Легендарные действия" rows={3} maxLength={4000} />
          {canManageGlobal && (
            <label>
              Scope
              <select value={scope} onChange={(event) => setScope(event.target.value as 'PERSONAL' | 'GLOBAL')}>
                <option value="PERSONAL">PERSONAL</option>
                <option value="GLOBAL">GLOBAL</option>
              </select>
            </label>
          )}
          <button className="btn btn-primary" disabled={creating} type="submit">
            {creating ? 'Создаём...' : 'Создать шаблон'}
          </button>
        </form>
      </div>

      <div className="section-card">
        <h2>Просмотр монстров</h2>
        <div className="tabs-row">
          <button className={`btn ${activeTab === 'PERSONAL' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('PERSONAL')}>
            Мои монстры
          </button>
          <button className={`btn ${activeTab === 'GLOBAL' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('GLOBAL')}>
            Глобальные
          </button>
        </div>
        {loading ? (
          <StatusBox type="info" message="Загрузка..." />
        ) : visibleItems.length === 0 ? (
          <StatusBox type="info" message={activeTab === 'PERSONAL' ? 'Персональных шаблонов пока нет' : 'Глобальных шаблонов пока нет'} />
        ) : (
          <div className="list-grid">
            {visibleItems.map(renderCard)}
          </div>
        )}
      </div>
    </div>
  );
}
