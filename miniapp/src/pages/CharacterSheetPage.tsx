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
      setError('Character id is missing');
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
    return <StatusBox type="info" message="Загрузка character sheet..." />;
  }

  if (error || !sheet) {
    return (
      <div className="page-stack">
        <StatusBox type="error" message={error || 'Sheet not found'} />
        <Link to="/">Back to characters</Link>
      </div>
    );
  }

  const abilityBase = sheet.abilityScores.base;
  const abilityEffective = sheet.abilityScores.effective;
  const abilityKeys: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  return (
    <div className="page-stack">
      <div className="toolbar">
        <Link to="/">← Back</Link>
      </div>

      <SectionCard title={`${sheet.character.name} · ${sheet.character.class.name} · Lv.${sheet.character.level}`}>
        <div className="grid-2">
          <div>Race: {sheet.character.race?.name || '—'}</div>
          <div>Background: {sheet.character.background?.name || '—'}</div>
        </div>
      </SectionCard>

      <SectionCard title="Ability Scores (Base / Effective)">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ability</th>
                <th>Base</th>
                <th>Effective</th>
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

      <SectionCard title="Derived Stats">
        <div className="grid-3">
          <div>AC: {sheet.derivedStats.armorClass}</div>
          <div>Attack Bonus: {sheet.derivedStats.attackBonus}</div>
          <div>Proficiency Bonus: {sheet.derivedStats.proficiencyBonus}</div>
          <div>Initiative: {sheet.derivedStats.initiative}</div>
          <div>Passive Perception: {sheet.derivedStats.passive.perception}</div>
          <div>Passive Investigation: {sheet.derivedStats.passive.investigation}</div>
          <div>Passive Insight: {sheet.derivedStats.passive.insight}</div>
        </div>
      </SectionCard>

      <SectionCard title="Saving Throws">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ability</th>
                <th>Proficient</th>
                <th>Bonus</th>
              </tr>
            </thead>
            <tbody>
              {sheet.savingThrows.map((save) => (
                <tr key={save.ability}>
                  <td>{save.ability.toUpperCase()}</td>
                  <td>{save.proficient ? 'Yes' : 'No'}</td>
                  <td>{save.bonus >= 0 ? `+${save.bonus}` : save.bonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Skills">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Skill</th>
                <th>Ability</th>
                <th>Proficient</th>
                <th>Bonus</th>
              </tr>
            </thead>
            <tbody>
              {sheet.skills.map((skill) => (
                <tr key={skill.id}>
                  <td>{skill.name}</td>
                  <td>{String(skill.ability).toUpperCase()}</td>
                  <td>{skill.proficient ? 'Yes' : 'No'}</td>
                  <td>{skill.bonus >= 0 ? `+${skill.bonus}` : skill.bonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Inventory">
        {sheet.inventory.length === 0 ? (
          <div>Inventory empty.</div>
        ) : (
          <div className="list-grid">
            {sheet.inventory.map((entry) => (
              <div className="list-item" key={entry.id}>
                <div>
                  <strong>{entry.item.name}</strong>
                  <div>{entry.item.slot || '—'}</div>
                </div>
                <span>{entry.equipped ? 'Equipped' : 'Unequipped'}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
