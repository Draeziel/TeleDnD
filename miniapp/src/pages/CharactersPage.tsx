import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { characterApi } from '../api/characterApi';
import { StatusBox } from '../components/StatusBox';
import type { CharacterSummary } from '../types/models';
import { useTelegram } from '../hooks/useTelegram';

export function CharactersPage() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="page-stack">
      <div className="toolbar">
        <button onClick={() => navigate('/create')}>Create Character</button>
      </div>

      {!isTelegram && (
        <div className="telegram-dev-box">
          <h3>Режим разработки Telegram</h3>
          <p>В Telegram не запущено. Укажите тестовый Telegram user id.</p>
          <div className="inline-row">
            <input
              value={testUserId}
              onChange={(e) => saveTestUserId(e.target.value)}
              placeholder="Например: 123456789"
            />
          </div>
        </div>
      )}

      <div className="meta-row">Текущий Telegram user id: {userId || 'не задан'}</div>

      {loading && <StatusBox type="info" message="Загрузка списка персонажей..." />}
      {error && <StatusBox type="error" message={error} />}

      {!loading && !error && (
        <div className="list-grid">
          {characters.length === 0 && <StatusBox type="info" message="Персонажей пока нет." />}
          {characters.map((character) => (
            <div className="list-item" key={character.id}>
              <div>
                <strong>{character.name}</strong>
                <div>Class: {character.class?.name || '—'}</div>
                <div>Level: {character.level}</div>
              </div>
              <button onClick={() => navigate(`/character/${character.id}`)}>Open Sheet</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
