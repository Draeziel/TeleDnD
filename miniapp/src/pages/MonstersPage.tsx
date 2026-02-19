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
  const [armorClass, setArmorClass] = useState(12);
  const [maxHp, setMaxHp] = useState(10);
  const [initiativeModifier, setInitiativeModifier] = useState(0);
  const [challengeRating, setChallengeRating] = useState('');
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
        armorClass,
        maxHp,
        initiativeModifier,
        challengeRating,
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
