import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { characterApi } from '../api/characterApi';
import { StatusBox } from '../components/StatusBox';
import type { CharacterSummary } from '../types/models';
import { useTelegram } from '../hooks/useTelegram';

export function CharactersPage() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { isTelegram, userId, testUserId, saveTestUserId } = useTelegram();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await characterApi.getCharacters();
        setCharacters(data);
      } catch {
        setError('Не удалось загрузить персонажей. Проверьте backend URL и доступность API.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleDelete = async (characterId: string) => {
    const confirmed = window.confirm('Удалить персонажа? Это действие нельзя отменить.');
    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(characterId);
      setError('');
      await characterApi.deleteCharacter(characterId);
      setCharacters((prev) => prev.filter((character) => character.id !== characterId));
      setSelectedCharacterId((current) => (current === characterId ? '' : current));
    } catch {
      setError('Не удалось удалить персонажа. Попробуйте снова.');
    } finally {
      setDeletingId(null);
    }
  };

  const onToggleCharacter = (characterId: string) => {
    setSelectedCharacterId((current) => (current === characterId ? '' : characterId));
  };

  const selectedCharacter = characters.find((item) => item.id === selectedCharacterId) || null;

  return (
    <div className="page-stack">
      <div className="section-card">
        <h2>Персонажи</h2>
        <p className="meta-row">Список персонажей: нажмите на имя, чтобы открыть и закрыть карточку.</p>
        <div className="inline-row">
          <button className="btn btn-primary" onClick={() => navigate('/create')}>Создать персонажа</button>
          <button className="btn btn-secondary" onClick={() => navigate('/sessions')}>Сессии</button>
        </div>
      </div>

      {!isTelegram && (
        <div className="telegram-dev-box">
          <h3>Режим разработки Telegram</h3>
          <p>В Telegram не запущено. Укажите тестовый ID пользователя Telegram.</p>
          <div className="inline-row">
            <input
              value={testUserId}
              onChange={(e) => saveTestUserId(e.target.value)}
              placeholder="Например: 123456789"
            />
          </div>
        </div>
      )}

      <div className="meta-row">Текущий ID пользователя Telegram: {userId || 'не задан'}</div>

      {loading && <StatusBox type="info" message="Загрузка списка персонажей..." />}
      {error && <StatusBox type="error" message={error} />}

      {!loading && !error && (
        <div className="section-card">
          <h2>Список персонажей</h2>
          {characters.length === 0 && <StatusBox type="info" message="Персонажей пока нет." />}
          {characters.length > 0 && (
            <div className="entity-list">
              {characters.map((character) => (
                <div className="entity-list-item" key={character.id}>
                  <div className="entity-list-icon placeholder">{character.name.slice(0, 1).toUpperCase()}</div>
                  <div className="entity-list-main">
                    <button className="btn btn-inline" onClick={() => onToggleCharacter(character.id)}>
                      {character.name}
                    </button>
                    <div className="entity-list-meta">Класс: {character.class?.name || '—'} · Уровень: {character.level}</div>
                  </div>
                  <div className="entity-list-actions">
                    <button className="btn btn-secondary btn-compact" onClick={() => navigate(`/character/${character.id}`)}>Открыть лист</button>
                    <button className="btn btn-danger btn-compact" disabled={deletingId === character.id} onClick={() => handleDelete(character.id)}>
                      {deletingId === character.id ? 'Удаление...' : 'Удалить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedCharacter && (
        <div className="section-card">
          <h2>Карточка персонажа</h2>
          <div className="entity-details-card">
            <div className="entity-details-title">{selectedCharacter.name}</div>
            <div className="meta-row">Класс: {selectedCharacter.class?.name || '—'}</div>
            <div className="meta-row">Раса: {selectedCharacter.race?.name || '—'}</div>
            <div className="meta-row">Предыстория: {selectedCharacter.background?.name || '—'}</div>
            <div className="meta-row">Уровень: {selectedCharacter.level}</div>
            <div className="inline-row">
              <button className="btn btn-primary btn-compact" onClick={() => navigate(`/character/${selectedCharacter.id}`)}>Открыть лист</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
