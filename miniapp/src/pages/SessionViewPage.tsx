import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi';
import { characterApi } from '../api/characterApi';
import { StatusBox } from '../components/StatusBox';
import type { CharacterSummary, SessionDetails } from '../types/models';

export function SessionViewPage() {
  const { id = '' } = useParams();
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [myCharacters, setMyCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
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

  const loadMyCharacters = async () => {
    try {
      const data = await characterApi.getCharacters();
      setMyCharacters(data);
    } catch {
      setError('Не удалось загрузить список ваших персонажей');
    }
  };

  useEffect(() => {
    load();
    loadMyCharacters();
    const timer = setInterval(load, 7000);
    return () => clearInterval(timer);
  }, [id]);

  const onAttachCharacter = async (characterId: string) => {
    try {
      setAttachingId(characterId);
      setError('');
      await sessionApi.attachCharacter(id, characterId);
      await load();
    } catch {
      setError('Не удалось добавить персонажа в сессию');
    } finally {
      setAttachingId(null);
    }
  };

  const onRemoveCharacter = async (characterId: string) => {
    try {
      setRemovingId(characterId);
      setError('');
      await sessionApi.removeCharacter(id, characterId);
      await load();
    } catch {
      setError('Не удалось убрать персонажа из сессии');
    } finally {
      setRemovingId(null);
    }
  };

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

  const attachedCharacterIds = new Set(session.characters.map((entry) => entry.character.id));
  const availableCharacters = myCharacters.filter((character) => !attachedCharacterIds.has(character.id));

  return (
    <div className="page-stack">
      <div className="section-card">
        <h2>{session.name}</h2>
        <div>Код входа: {session.joinCode}</div>
        <div>Игроки: {session.players.length}</div>
        <div>Персонажи: {session.characters.length}</div>
      </div>

      <div className="section-card">
        <h2>Группа</h2>
        <div className="list-grid">
          {session.characters.length === 0 && <StatusBox type="info" message="Персонажи пока не добавлены" />}
          {session.characters.map((entry) => {
            const currentHp = entry.state?.currentHp ?? 0;
            const initiative = entry.state?.initiative ?? 0;

            return (
              <div className="list-item" key={entry.id}>
                <div>
                  <strong>{entry.character.name}</strong>
                  <div>Класс: {entry.character.class?.name || '—'}</div>
                  <div>HP: {currentHp} / {entry.state?.maxHpSnapshot ?? '—'}</div>
                  <div>Инициатива: {entry.state?.initiative ?? '—'}</div>
                  <div>Эффекты: {entry.effects.length}</div>
                </div>
                <div className="inline-row">
                  <button
                    disabled={removingId === entry.character.id}
                    onClick={() => onRemoveCharacter(entry.character.id)}
                  >
                    {removingId === entry.character.id ? 'Открепление...' : 'Открепить'}
                  </button>
                  <button onClick={() => onSetHp(entry.character.id, Math.max(currentHp - 1, 0))}>HP -1</button>
                  <button onClick={() => onSetHp(entry.character.id, currentHp + 1)}>HP +1</button>
                  <button onClick={() => onSetInitiative(entry.character.id, initiative + 1)}>Иниц. +1</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-card">
        <h2>Добавить своего персонажа</h2>
        <div className="list-grid">
          {availableCharacters.length === 0 && (
            <StatusBox type="info" message="Нет свободных персонажей для добавления" />
          )}
          {availableCharacters.map((character) => (
            <div className="list-item" key={character.id}>
              <div>
                <strong>{character.name}</strong>
                <div>Класс: {character.class?.name || '—'}</div>
                <div>Уровень: {character.level}</div>
              </div>
              <button disabled={attachingId === character.id} onClick={() => onAttachCharacter(character.id)}>
                {attachingId === character.id ? 'Добавление...' : 'Добавить'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
