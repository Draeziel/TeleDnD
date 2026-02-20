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
  const [statusPanelExpanded, setStatusPanelExpanded] = useState(false);
  const [statusSearch, setStatusSearch] = useState('');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusName, setStatusName] = useState('');
  const [statusType, setStatusType] = useState<'DAMAGE' | 'CONTROL' | 'DEBUFF'>('DAMAGE');
  const [statusElement, setStatusElement] = useState<'FIRE' | 'POISON' | 'PHYSICAL'>('POISON');
  const [statusRounds, setStatusRounds] = useState(3);
  const [statusDamageDiceCount, setStatusDamageDiceCount] = useState(1);
  const [statusDamageDiceSides, setStatusDamageDiceSides] = useState(6);
  const [statusSaveDamagePercent, setStatusSaveDamagePercent] = useState<0 | 50 | 100 | 200>(50);
  const [statusSaveDiceCount, setStatusSaveDiceCount] = useState(1);
  const [statusSaveDiceSides, setStatusSaveDiceSides] = useState(12);
  const [statusSaveOperator, setStatusSaveOperator] = useState<'<' | '<=' | '=' | '>=' | '>'>('>=');
  const [statusSaveTargetValue, setStatusSaveTargetValue] = useState(10);
  const [statusColorHex, setStatusColorHex] = useState('#5b9cff');
  const [statusEditingId, setStatusEditingId] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
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
  const filteredStatusTemplates = useMemo(() => {
    const query = statusSearch.trim().toLowerCase();
    if (!query) {
      return statusTemplates;
    }

    return statusTemplates.filter((template) => template.name.toLowerCase().includes(query));
  }, [statusTemplates, statusSearch]);

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

  const resetStatusForm = () => {
    setStatusEditingId('');
    setStatusName('');
    setStatusType('DAMAGE');
    setStatusElement('POISON');
    setStatusRounds(3);
    setStatusDamageDiceCount(1);
    setStatusDamageDiceSides(6);
    setStatusSaveDamagePercent(50);
    setStatusSaveDiceCount(1);
    setStatusSaveDiceSides(12);
    setStatusSaveOperator('>=');
    setStatusSaveTargetValue(10);
    setStatusColorHex('#5b9cff');
  };

  const openCreateStatusModal = () => {
    resetStatusForm();
    setStatusModalOpen(true);
  };

  const onEditStatusTemplate = (template: StatusTemplate) => {
    const automation = (template.payload?.automation || {}) as Record<string, unknown>;
    const damage = (automation.damage || {}) as Record<string, unknown>;
    const save = (automation.save || {}) as Record<string, unknown>;
    const check = (save.check || {}) as Record<string, unknown>;
    const meta = (template.payload?.meta || {}) as Record<string, unknown>;

    setStatusEditingId(template.id);
    setStatusName(template.name);
    setStatusType((String(meta.statusType || 'DAMAGE').toUpperCase() as 'DAMAGE' | 'CONTROL' | 'DEBUFF'));
    setStatusElement((String(meta.statusElement || 'POISON').toUpperCase() as 'FIRE' | 'POISON' | 'PHYSICAL'));
    setStatusRounds(Number(automation.roundsLeft || template.defaultDuration || 3));
    setStatusDamageDiceCount(Number(damage.count || 1));
    setStatusDamageDiceSides(Number(damage.sides || 6));
    setStatusSaveDamagePercent(([0, 50, 100, 200].includes(Number(save.damagePercentOnMatch))
      ? Number(save.damagePercentOnMatch)
      : 50) as 0 | 50 | 100 | 200);
    setStatusSaveDiceCount(Number(check.count || 1));
    setStatusSaveDiceSides(Number(check.sides || save.dieSides || 12));
    setStatusSaveOperator((['<', '<=', '=', '>=', '>'].includes(String(check.operator))
      ? String(check.operator)
      : '>=') as '<' | '<=' | '=' | '>=' | '>');
    setStatusSaveTargetValue(Number(check.target || save.threshold || save.dc || 10));
    setStatusColorHex(String(meta.colorHex || '#5b9cff'));
    setStatusModalOpen(true);
  };

  const onSubmitStatusTemplate = async () => {
    if (!statusName.trim()) {
      setError('Укажите название шаблона статуса');
      return;
    }

    try {
      setStatusSaving(true);
      setError('');
      const payload = {
        name: statusName.trim(),
        statusType,
        statusElement,
        rounds: statusRounds,
        damageDiceCount: statusDamageDiceCount,
        damageDiceSides: statusDamageDiceSides,
        saveDamagePercent: statusSaveDamagePercent,
        saveDiceCount: statusSaveDiceCount,
        saveDiceSides: statusSaveDiceSides,
        saveOperator: statusSaveOperator,
        saveTargetValue: statusSaveTargetValue,
        colorHex: statusColorHex,
      } as const;

      if (!statusEditingId) {
        const created = await monsterApi.createStatusTemplate({
          ...payload,
          isActive: true,
        });
        setStatusTemplates((current) => [created, ...current]);
      } else {
        const updated = await monsterApi.updateStatusTemplate(statusEditingId, payload);
        setStatusTemplates((current) => current.map((item) => (item.id === statusEditingId ? updated : item)));
      }

      resetStatusForm();
      setStatusModalOpen(false);
    } catch {
      setError(statusEditingId ? 'Не удалось обновить шаблон статуса' : 'Не удалось создать шаблон статуса');
    } finally {
      setStatusSaving(false);
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
      if (statusEditingId === template.id) {
        resetStatusForm();
      }
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
        <h2>Статусы</h2>
        <div className="inline-row" style={{ alignItems: 'center' }}>
          <button
            className={`btn ${statusPanelExpanded ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusPanelExpanded((current) => !current)}
          >
            Просмотр
          </button>
          <button className="btn btn-secondary btn-icon" title="Добавить статус" onClick={openCreateStatusModal}>
            +
          </button>
          <input
            placeholder="Поиск по названию"
            value={statusSearch}
            onChange={(event) => setStatusSearch(event.target.value)}
          />
        </div>

        {statusPanelExpanded && (filteredStatusTemplates.length === 0 ? (
          <StatusBox type="info" message="Шаблоны статусов пока не найдены" />
        ) : (
          <div className="monster-list" style={{ marginTop: 8 }}>
            {filteredStatusTemplates.map((template) => {
              const automation = (template.payload?.automation || {}) as Record<string, unknown>;
              const damage = (automation.damage || {}) as Record<string, unknown>;
              const save = (automation.save || {}) as Record<string, unknown>;
              const check = (save.check || {}) as Record<string, unknown>;
              const meta = (template.payload?.meta || {}) as Record<string, unknown>;
              const rounds = Number(automation.roundsLeft || template.defaultDuration || 0);
              const templateStatusType = String(meta.statusType || (automation.kind ? 'DAMAGE' : 'CONTROL'));
              const templateStatusElement = String(meta.statusElement || 'POISON');
              const damageText = damage.mode === 'dice'
                ? `${damage.count || 1}d${damage.sides || 6}`
                : `${automation.damagePerTick || 1}`;
              const saveDamagePercent = Number(save.damagePercentOnMatch ?? 50);
              const saveDiceCount = Number(check.count || 1);
              const saveDiceSides = Number(check.sides || save.dieSides || 12);
              const saveOperator = String(check.operator || '>=');
              const saveTarget = Number(check.target || save.threshold || save.dc || 10);
              const colorHex = String(meta.colorHex || '#5b9cff');

              return (
                <div className="monster-list-item" key={template.id} style={{ borderLeft: `4px solid ${colorHex}` }}>
                  <div>
                    <strong>{template.name}</strong>
                    <div className="meta-row">{templateStatusType} / {templateStatusElement} • {rounds} раунд(ов)</div>
                    <div className="meta-row">Урон: {damageText}</div>
                    <div className="meta-row">Спасбросок: получает {saveDamagePercent}% урона, если результат {saveDiceCount}д{saveDiceSides} + CON {saveOperator} {saveTarget}</div>
                  </div>
                  <div className="inline-row">
                    <button
                      className="btn btn-secondary btn-compact"
                      onClick={() => onEditStatusTemplate(template)}
                      title="Редактировать"
                    >
                      ✎
                    </button>
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
                      title="Удалить"
                    >
                      {statusDeletingId === template.id ? '...' : '🗑'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {statusModalOpen && (
        <div className="combat-modal-backdrop" onClick={() => setStatusModalOpen(false)}>
          <div className="combat-modal" onClick={(event) => event.stopPropagation()}>
            <div className="combat-modal-head">
              <strong>{statusEditingId ? 'Редактирование статуса' : 'Создание статуса'}</strong>
              <button className="btn btn-inline" onClick={() => setStatusModalOpen(false)}>✕</button>
            </div>

            <div className="combat-modal-body">
              <input
                placeholder="Название"
                value={statusName}
                onChange={(event) => setStatusName(event.target.value)}
              />

              <label className="meta-row">Тип статуса</label>
              <select value={statusType} onChange={(event) => setStatusType(event.target.value as 'DAMAGE' | 'CONTROL' | 'DEBUFF')}>
                <option value="DAMAGE">Урон</option>
                <option value="CONTROL">Контроль</option>
                <option value="DEBUFF">Дебафф</option>
              </select>

              <label className="meta-row">Стихия статуса</label>
              <select value={statusElement} onChange={(event) => setStatusElement(event.target.value as 'FIRE' | 'POISON' | 'PHYSICAL')}>
                <option value="FIRE">Огонь</option>
                <option value="POISON">Яд</option>
                <option value="PHYSICAL">Физический</option>
              </select>

              <label className="meta-row">Количество раундов</label>
              <input
                type="number"
                min={1}
                max={20}
                value={statusRounds}
                onChange={(event) => setStatusRounds(Number(event.target.value) || 1)}
              />

              <div className="meta-row">Наносит [количество дайсов] d [количество граней] урона</div>
              <div className="grid-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={statusDamageDiceCount}
                  onChange={(event) => setStatusDamageDiceCount(Number(event.target.value) || 1)}
                />
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={statusDamageDiceSides}
                  onChange={(event) => setStatusDamageDiceSides(Number(event.target.value) || 6)}
                />
              </div>

              <div className="meta-row">Спасбросок: получает [% урона], если результат [XdY + CON] [оператор] [значение]</div>
              <div className="grid-2">
                <select
                  value={statusSaveDamagePercent}
                  onChange={(event) => setStatusSaveDamagePercent(Number(event.target.value) as 0 | 50 | 100 | 200)}
                >
                  <option value={0}>0%</option>
                  <option value={50}>50%</option>
                  <option value={100}>100%</option>
                  <option value={200}>200%</option>
                </select>
                <div className="meta-row">% урона при выполнении условия</div>
              </div>

              <div className="grid-3">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={statusSaveDiceCount}
                  onChange={(event) => setStatusSaveDiceCount(Number(event.target.value) || 1)}
                />
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={statusSaveDiceSides}
                  onChange={(event) => setStatusSaveDiceSides(Number(event.target.value) || 12)}
                />
                <select value={statusSaveOperator} onChange={(event) => setStatusSaveOperator(event.target.value as '<' | '<=' | '=' | '>=' | '>')}>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                  <option value="=">=</option>
                  <option value=">=">&gt;=</option>
                  <option value=">">&gt;</option>
                </select>
              </div>

              <input
                type="number"
                min={1}
                max={200}
                value={statusSaveTargetValue}
                onChange={(event) => setStatusSaveTargetValue(Number(event.target.value) || 10)}
                placeholder="Значение для прохождения"
              />

              <label className="meta-row">Цвет текста/рамки статуса</label>
              <input type="color" value={statusColorHex} onChange={(event) => setStatusColorHex(event.target.value)} />

              <div className="inline-row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setStatusModalOpen(false)}>Отмена</button>
                <button className="btn btn-primary" onClick={onSubmitStatusTemplate} disabled={statusSaving}>
                  {statusSaving ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
