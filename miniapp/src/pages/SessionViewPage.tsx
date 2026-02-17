import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi';
import { StatusBox } from '../components/StatusBox';
import type { SessionDetails } from '../types/models';

export function SessionViewPage() {
  const { id = '' } = useParams();
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const data = await sessionApi.getSession(id);
      setSession(data);
    } catch {
      setError('Не удалось загрузить данные сессии');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 7000);
    return () => clearInterval(timer);
  }, [id]);

  const onSetHp = async (characterId: string, hp: number) => {
    try {
      await sessionApi.setHp(id, characterId, hp);
      await load();
    } catch {
      setError('Не удалось изменить HP (нужна роль GM)');
    }
  };

  const onSetInitiative = async (characterId: string, initiative: number) => {
    try {
      await sessionApi.setInitiative(id, characterId, initiative);
      await load();
    } catch {
      setError('Не удалось изменить инициативу (нужна роль GM)');
    }
  };

  if (loading) return <StatusBox type="info" message="Загрузка сессии..." />;
  if (error) return <StatusBox type="error" message={error} />;
  if (!session) return <StatusBox type="info" message="Сессия не найдена" />;

  return (
    <div className="page-stack">
      <div className="section-card">
        <h2>{session.name}</h2>
        <div>Join code: {session.joinCode}</div>
        <div>Players: {session.players.length}</div>
        <div>Characters: {session.characters.length}</div>
      </div>

      <div className="section-card">
        <h2>Party</h2>
        <div className="list-grid">
          {session.characters.length === 0 && <StatusBox type="info" message="Персонажи пока не добавлены" />}
          {session.characters.map((entry) => {
            const currentHp = entry.state?.currentHp ?? 0;
            const initiative = entry.state?.initiative ?? 0;

            return (
              <div className="list-item" key={entry.id}>
                <div>
                  <strong>{entry.character.name}</strong>
                  <div>Class: {entry.character.class?.name || '—'}</div>
                  <div>HP: {currentHp} / {entry.state?.maxHpSnapshot ?? '—'}</div>
                  <div>Initiative: {entry.state?.initiative ?? '—'}</div>
                  <div>Effects: {entry.effects.length}</div>
                </div>
                <div className="inline-row">
                  <button onClick={() => onSetHp(entry.character.id, Math.max(currentHp - 1, 0))}>HP -1</button>
                  <button onClick={() => onSetHp(entry.character.id, currentHp + 1)}>HP +1</button>
                  <button onClick={() => onSetInitiative(entry.character.id, initiative + 1)}>Init +1</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
