import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { characterApi } from '../api/characterApi';
import type { AbilityKey, CharacterSheet } from '../types/models';
import { StatusBox } from '../components/StatusBox';
import { SectionCard } from '../components/SectionCard';

export function CharacterSheetPage() {
  const { id } = useParams();
  const [sheet, setSheet] = useState<CharacterSheet | null>(null);
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
    </div>
  );
}
