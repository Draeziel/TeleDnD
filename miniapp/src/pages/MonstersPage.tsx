import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { monsterApi } from '../api/monsterApi';
import { StatusBox } from '../components/StatusBox';
import type { MonsterTemplate } from '../types/models';

export function MonstersPage() {
  const [items, setItems] = useState<MonsterTemplate[]>([]);
  const [canManageGlobal, setCanManageGlobal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [name, setName] = useState('');
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
      setChallengeRating('');
      setSource('');
      await load();
    } catch {
      setError('Не удалось создать шаблон монстра');
    } finally {
      setCreating(false);
    }
  };

  const globalItems = useMemo(() => items.filter((item) => item.scope === 'GLOBAL'), [items]);
  const personalItems = useMemo(() => items.filter((item) => item.scope === 'PERSONAL'), [items]);

  return (
    <div className="page-stack">
      <div className="section-card">
        <h2>Монстры</h2>
        <p className="meta-row">Каталог мастера: глобальные шаблоны + персональные шаблоны пользователя.</p>
      </div>

      {status && <StatusBox type="success" message={status} />}
      {error && <StatusBox type="error" message={error} />}

      <div className="section-card">
        <h2>Быстро создать шаблон</h2>
        <form className="form-stack" onSubmit={onCreate}>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Название монстра"
            minLength={2}
            maxLength={80}
          />
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
        <h2>Глобальный каталог</h2>
        {loading ? (
          <StatusBox type="info" message="Загрузка..." />
        ) : globalItems.length === 0 ? (
          <StatusBox type="info" message="Глобальных шаблонов пока нет" />
        ) : (
          <div className="list-grid">
            {globalItems.map((monster) => (
              <div className="list-item" key={monster.id}>
                <div>
                  <strong>{monster.name}</strong>
                  <div>{[monster.size, monster.creatureType, monster.alignment].filter(Boolean).join(', ') || '—'}</div>
                  <div>AC: {monster.armorClass} • HP: {monster.maxHp} • Init: {monster.initiativeModifier >= 0 ? '+' : ''}{monster.initiativeModifier}</div>
                </div>
                <span>{monster.challengeRating || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-card">
        <h2>Мои шаблоны</h2>
        {loading ? (
          <StatusBox type="info" message="Загрузка..." />
        ) : personalItems.length === 0 ? (
          <StatusBox type="info" message="Персональных шаблонов пока нет" />
        ) : (
          <div className="list-grid">
            {personalItems.map((monster) => (
              <div className="list-item" key={monster.id}>
                <div>
                  <strong>{monster.name}</strong>
                  <div>{[monster.size, monster.creatureType, monster.alignment].filter(Boolean).join(', ') || '—'}</div>
                  <div>AC: {monster.armorClass} • HP: {monster.maxHp} • Init: {monster.initiativeModifier >= 0 ? '+' : ''}{monster.initiativeModifier}</div>
                </div>
                <span>{monster.challengeRating || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
