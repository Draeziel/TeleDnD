import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { monsterApi } from '../api/monsterApi';
import { StatusBox } from '../components/StatusBox';
import type { MonsterTemplate, StatusTemplate } from '../types/models';

type MonstersTab = 'PERSONAL' | 'GLOBAL';

export function MonstersPage() {
  const [items, setItems] = useState<MonsterTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<MonstersTab>('PERSONAL');
  const [selectedMonsterId, setSelectedMonsterId] = useState('');
  const [deletingMonsterId, setDeletingMonsterId] = useState('');
  const [statusTemplates, setStatusTemplates] = useState<StatusTemplate[]>([]);
  const [statusName, setStatusName] = useState('');
  const [statusEffectType, setStatusEffectType] = useState('poisoned');
  const [statusDuration, setStatusDuration] = useState('3 раунд(ов)');
  const [statusDamageCount, setStatusDamageCount] = useState(1);
  const [statusDamageSides, setStatusDamageSides] = useState(6);
  const [statusSaveDieSides, setStatusSaveDieSides] = useState(12);
  const [statusSaveThreshold, setStatusSaveThreshold] = useState(10);
  const [statusCreating, setStatusCreating] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [statusDeletingId, setStatusDeletingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');

      const payload = await monsterApi.listTemplates({ scope: 'all' });
      const statusPayload = await monsterApi.listStatusTemplates();
      setItems(payload.items);
      setStatusTemplates(statusPayload.items);
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

  const onToggleMonsterCard = (monsterId: string) => {
    setSelectedMonsterId((currentId) => (currentId === monsterId ? '' : monsterId));
  };

  const onDeleteMonster = async (monster: MonsterTemplate) => {
    const shouldDelete = window.confirm(`Удалить шаблон «${monster.name}»?`);
    if (!shouldDelete) {
      return;
    }

    try {
      setDeletingMonsterId(monster.id);
      setError('');
      await monsterApi.deleteTemplate(monster.id);
      setItems((current) => current.filter((item) => item.id !== monster.id));
      setSelectedMonsterId((currentId) => (currentId === monster.id ? '' : currentId));
    } catch {
      setError('Не удалось удалить шаблон монстра');
    } finally {
      setDeletingMonsterId('');
    }
  };

  const onCreateStatusTemplate = async () => {
    if (!statusName.trim()) {
      setError('Укажите название шаблона статуса');
      return;
    }

    try {
      setStatusCreating(true);
      setError('');
      const created = await monsterApi.createStatusTemplate({
        name: statusName.trim(),
        effectType: statusEffectType.trim() || 'poisoned',
        defaultDuration: statusDuration.trim() || '3 раунд(ов)',
        damageMode: 'dice',
        damageCount: statusDamageCount,
        damageSides: statusDamageSides,
        damageBonus: 0,
        rounds: Number((statusDuration.match(/(\d+)/) || [])[1]) || 3,
        saveDieSides: statusSaveDieSides,
        saveThreshold: statusSaveThreshold,
        halfOnSave: true,
        isActive: true,
      });

      setStatusTemplates((current) => [created, ...current]);
      setStatusName('');
    } catch {
      setError('Не удалось создать шаблон статуса');
    } finally {
      setStatusCreating(false);
    }
  };

  const onToggleStatusTemplate = async (template: StatusTemplate) => {
    try {
      setStatusUpdatingId(template.id);
      setError('');
      const updated = await monsterApi.updateStatusTemplate(template.id, {
        isActive: !template.isActive,
      });

      setStatusTemplates((current) => current.map((item) => (item.id === template.id ? updated : item)));
    } catch {
      setError('Не удалось обновить шаблон статуса');
    } finally {
      setStatusUpdatingId('');
    }
  };

  const onDeleteStatusTemplate = async (template: StatusTemplate) => {
    const shouldDelete = window.confirm(`Удалить шаблон статуса «${template.name}»?`);
    if (!shouldDelete) {
      return;
    }

    try {
      setStatusDeletingId(template.id);
      setError('');
      await monsterApi.deleteStatusTemplate(template.id);
      setStatusTemplates((current) => current.filter((item) => item.id !== template.id));
    } catch {
      setError('Не удалось удалить шаблон статуса');
    } finally {
      setStatusDeletingId('');
    }
  };

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
                  onClick={() => onToggleMonsterCard(monster.id)}
                >
                  {monster.name}
                </button>
                <div className="inline-row">
                  <Link className="btn btn-secondary btn-compact" to={`/monsters/${monster.id}/edit`}>
                    Редактировать
                  </Link>
                  <button
                    className="btn btn-secondary btn-compact"
                    onClick={() => onDeleteMonster(monster)}
                    disabled={deletingMonsterId === monster.id}
                  >
                    {deletingMonsterId === monster.id ? 'Удаляем...' : 'Удалить'}
                  </button>
                </div>
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

      <div className="section-card">
        <h2>Шаблоны статусов</h2>
        <p className="meta-row">Управление шаблонами для боевых эффектов (используются в модалке статусов в сессии).</p>

        <div className="grid-3">
          <input
            placeholder="Название шаблона"
            value={statusName}
            onChange={(event) => setStatusName(event.target.value)}
          />
          <input
            placeholder="effectType"
            value={statusEffectType}
            onChange={(event) => setStatusEffectType(event.target.value)}
          />
          <input
            placeholder="Длительность"
            value={statusDuration}
            onChange={(event) => setStatusDuration(event.target.value)}
          />
        </div>

        <div className="grid-3" style={{ marginTop: 8 }}>
          <input
            type="number"
            min={1}
            max={20}
            value={statusDamageCount}
            onChange={(event) => setStatusDamageCount(Number(event.target.value) || 1)}
          />
          <input
            type="number"
            min={2}
            max={100}
            value={statusDamageSides}
            onChange={(event) => setStatusDamageSides(Number(event.target.value) || 6)}
          />
          <button className="btn btn-primary" onClick={onCreateStatusTemplate} disabled={statusCreating}>
            {statusCreating ? 'Создаём...' : 'Создать шаблон'}
          </button>
        </div>

        <div className="grid-3" style={{ marginTop: 8 }}>
          <input
            type="number"
            min={2}
            max={100}
            value={statusSaveDieSides}
            onChange={(event) => setStatusSaveDieSides(Number(event.target.value) || 12)}
          />
          <input
            type="number"
            min={1}
            max={100}
            value={statusSaveThreshold}
            onChange={(event) => setStatusSaveThreshold(Number(event.target.value) || 10)}
          />
          <div className="meta-row">Save: d{statusSaveDieSides} + CON vs {statusSaveThreshold}</div>
        </div>

        {statusTemplates.length === 0 ? (
          <StatusBox type="info" message="Шаблоны статусов пока не созданы" />
        ) : (
          <div className="monster-list" style={{ marginTop: 8 }}>
            {statusTemplates.map((template) => {
              const automation = (template.payload?.automation || {}) as Record<string, unknown>;
              const damage = (automation.damage || {}) as Record<string, unknown>;
              const save = (automation.save || {}) as Record<string, unknown>;
              const damageText = damage.mode === 'dice'
                ? `${damage.count || 1}d${damage.sides || 6}${Number(damage.bonus || 0) >= 0 ? '+' : ''}${damage.bonus || 0}`
                : `${automation.damagePerTick || 1}`;
              const saveDieSides = Number(save.dieSides || 12);
              const saveThreshold = Number(save.threshold || save.dc || 10);

              return (
                <div className="monster-list-item" key={template.id}>
                  <div>
                    <strong>{template.name}</strong>
                    <div className="meta-row">{template.effectType} • {template.defaultDuration}</div>
                    <div className="meta-row">Урон: {damageText} • Save: d{saveDieSides}+CON vs {saveThreshold}</div>
                  </div>
                  <div className="inline-row">
                    <button
                      className="btn btn-secondary btn-compact"
                      onClick={() => onToggleStatusTemplate(template)}
                      disabled={statusUpdatingId === template.id}
                    >
                      {statusUpdatingId === template.id ? 'Сохраняем...' : (template.isActive ? 'Отключить' : 'Включить')}
                    </button>
                    <button
                      className="btn btn-secondary btn-compact"
                      onClick={() => onDeleteStatusTemplate(template)}
                      disabled={statusDeletingId === template.id}
                    >
                      {statusDeletingId === template.id ? 'Удаляем...' : 'Удалить'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
