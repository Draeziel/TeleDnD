import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { characterApi } from '../api/characterApi';
import { sessionApi } from '../api/sessionApi';
import type { AbilityKey, CharacterSheet, SessionListItem } from '../types/models';
import { StatusBox } from '../components/StatusBox';
import { SectionCard } from '../components/SectionCard';

export function CharacterSheetPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [sheet, setSheet] = useState<CharacterSheet | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [attachStatus, setAttachStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Отсутствует ID персонажа');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await characterApi.getCharacterSheet(id);
        setSheet(data);
      } catch {
        setError('Не удалось загрузить sheet персонажа.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await sessionApi.listSessions();
        setSessions(data);
        if (data.length > 0) {
          setSelectedSessionId((prev) => prev || data[0].id);
        }
      } catch {
        return;
      }
    };

    loadSessions();
  }, []);

  const onAttachToSession = async () => {
    if (!id || !selectedSessionId) {
      return;
    }

    try {
      setAttaching(true);
      setAttachStatus(null);
      await sessionApi.attachCharacter(selectedSessionId, id);
      setAttachStatus({ type: 'success', message: 'Персонаж добавлен в сессию' });
    } catch {
      setAttachStatus({ type: 'error', message: 'Не удалось добавить персонажа в сессию' });
    } finally {
      setAttaching(false);
    }
  };

  if (loading) {
    return <StatusBox type="info" message="Загрузка листа персонажа..." />;
  }

  if (error || !sheet) {
    return (
      <div className="page-stack">
        <StatusBox type="error" message={error || 'Лист персонажа не найден'} />
        <Link to="/">Назад к персонажам</Link>
      </div>
    );
  }

  const abilityBase = sheet.abilityScores.base;
  const abilityEffective = sheet.abilityScores.effective;
  const abilityKeys: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const savingThrows = Array.isArray(sheet.savingThrows) ? sheet.savingThrows : [];
  const skills = Array.isArray(sheet.skills) ? sheet.skills : [];
  const inventory = Array.isArray(sheet.inventory) ? sheet.inventory : [];

  return (
    <div className="page-stack">
      <div className="toolbar">
        <Link to="/">← Назад</Link>
      </div>

      <SectionCard title={`${sheet.character.name} · ${sheet.character.class.name} · Lv.${sheet.character.level}`}>
        <div className="grid-2">
          <div>Раса: {sheet.character.race?.name || '—'}</div>
          <div>Предыстория: {sheet.character.background?.name || '—'}</div>
        </div>
      </SectionCard>

      <SectionCard title="Характеристики (базовые / итоговые)">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Характеристика</th>
                <th>Базовая</th>
                <th>Итоговая</th>
              </tr>
            </thead>
            <tbody>
              {abilityKeys.map((ability) => (
                <tr key={ability}>
                  <td>{ability.toUpperCase()}</td>
                  <td>{abilityBase ? abilityBase[ability] : '—'}</td>
                  <td>{abilityEffective ? abilityEffective[ability] : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Производные параметры">
        <div className="grid-3">
          <div>КД: {sheet.derivedStats.armorClass}</div>
          <div>Бонус атаки: {sheet.derivedStats.attackBonus}</div>
          <div>Бонус мастерства: {sheet.derivedStats.proficiencyBonus}</div>
          <div>Инициатива: {sheet.derivedStats.initiative}</div>
          <div>Пассивное внимание: {sheet.derivedStats.passive.perception}</div>
          <div>Пассивное расследование: {sheet.derivedStats.passive.investigation}</div>
          <div>Пассивная проницательность: {sheet.derivedStats.passive.insight}</div>
        </div>
      </SectionCard>

      <SectionCard title="Спасброски">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Характеристика</th>
                <th>Владение</th>
                <th>Бонус</th>
              </tr>
            </thead>
            <tbody>
              {savingThrows.map((save) => (
                <tr key={save.ability}>
                  <td>{save.ability.toUpperCase()}</td>
                  <td>{save.proficient ? 'Да' : 'Нет'}</td>
                  <td>{save.bonus >= 0 ? `+${save.bonus}` : save.bonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Навыки">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Навык</th>
                <th>Характеристика</th>
                <th>Владение</th>
                <th>Бонус</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr key={skill.id}>
                  <td>{skill.name}</td>
                  <td>{String(skill.ability).toUpperCase()}</td>
                  <td>{skill.proficient ? 'Да' : 'Нет'}</td>
                  <td>{skill.bonus >= 0 ? `+${skill.bonus}` : skill.bonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Инвентарь">
        {inventory.length === 0 ? (
          <div>Инвентарь пуст.</div>
        ) : (
          <div className="list-grid">
            {inventory.map((entry) => (
              <div className="list-item" key={entry.id}>
                <div>
                  <strong>{entry.item.name}</strong>
                  <div>{entry.item.slot || '—'}</div>
                </div>
                <span>{entry.equipped ? 'Экипировано' : 'Не экипировано'}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Добавить в сессию">
        {sessions.length === 0 ? (
          <StatusBox type="info" message="Сессии не найдены или недоступны" />
        ) : (
          <div className="form-stack">
            <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)}>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} ({session.role === 'GM' ? 'Мастер' : 'Игрок'})
                </option>
              ))}
            </select>
            <div className="inline-row">
              <button disabled={attaching || !selectedSessionId} onClick={onAttachToSession}>
                {attaching ? 'Добавление...' : 'Добавить в сессию'}
              </button>
              <button disabled={!selectedSessionId} onClick={() => navigate(`/sessions/${selectedSessionId}`)}>
                Открыть сессию
              </button>
            </div>
          </div>
        )}

        {attachStatus && <StatusBox type={attachStatus.type} message={attachStatus.message} />}
      </SectionCard>
    </div>
  );
}
