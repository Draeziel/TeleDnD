import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { monsterApi } from '../api/monsterApi';
import { StatusBox } from '../components/StatusBox';
import type { MonsterTemplate } from '../types/models';

type MonstersTab = 'PERSONAL' | 'GLOBAL';

export function MonstersPage() {
  const [items, setItems] = useState<MonsterTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<MonstersTab>('PERSONAL');
  const [selectedMonsterId, setSelectedMonsterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');

      const payload = await monsterApi.listTemplates({ scope: 'all' });
      setItems(payload.items);
      if (!payload.canManageGlobal) {
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

  const globalItems = useMemo(() => items.filter((item) => item.scope === 'GLOBAL'), [items]);
  const personalItems = useMemo(() => items.filter((item) => item.scope === 'PERSONAL'), [items]);
  const visibleItems = activeTab === 'PERSONAL' ? personalItems : globalItems;
  const selectedMonster = visibleItems.find((monster) => monster.id === selectedMonsterId) || null;

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
        <p className="meta-row">Список монстров: иконка + название. Нажмите на название, чтобы открыть карточку.</p>
        <div className="inline-row">
          <Link className="btn btn-primary" to="/monsters/create">Создать монстра</Link>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>Обновить</button>
        </div>
      </div>

      {error && <StatusBox type="error" message={error} />}

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
          <div className="monster-list">
            {visibleItems.map((monster) => (
              <div className="monster-list-item" key={monster.id}>
                {monster.iconUrl ? (
                  <img className="monster-list-icon" src={monster.iconUrl} alt={`${monster.name} icon`} />
                ) : (
                  <div className="monster-list-icon placeholder">?</div>
                )}
                <button
                  className="btn btn-inline"
                  onClick={() => setSelectedMonsterId(monster.id)}
                >
                  {monster.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMonster && (
        <div className="section-card">
          <h2>Карточка монстра</h2>
          {renderCard(selectedMonster)}
        </div>
      )}
    </div>
  );
}
