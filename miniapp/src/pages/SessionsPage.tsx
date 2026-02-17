import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi';
import { StatusBox } from '../components/StatusBox';
import type { SessionListItem } from '../types/models';
import { showConfirm } from '../telegram/webApp';

export function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const roleLabel = (role: SessionListItem['role']) => (role === 'GM' ? 'Мастер' : 'Игрок');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await sessionApi.listSessions();
      setSessions(data);
    } catch {
      setError('Не удалось загрузить сессии. Проверьте авторизацию и доступность backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    if (!createName.trim()) return;

    try {
      const created = await sessionApi.createSession(createName.trim());
      setCreateName('');
      navigate(`/sessions/${created.id}`);
    } catch {
      setError('Не удалось создать сессию');
    }
  };

  const onJoin = async () => {
    if (!joinCode.trim()) return;

    try {
      const joined = await sessionApi.joinSession(joinCode.trim().toUpperCase());
      setJoinCode('');
      navigate(`/sessions/${joined.sessionId}`);
    } catch {
      setError('Не удалось присоединиться к сессии (проверьте код)');
    }
  };

  const onDelete = async (sessionId: string) => {
    const confirmed = await showConfirm('Удалить сессию? Это действие нельзя отменить.');
    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(sessionId);
      setError('');
      await sessionApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    } catch {
      setError('Не удалось удалить сессию. Удаление доступно только для ГМа.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-stack">
      <div className="toolbar">
        <input
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder="Название сессии"
        />
        <button onClick={onCreate} disabled={!createName.trim()}>
          Создать сессию
        </button>
      </div>

      <div className="toolbar">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Код входа"
        />
        <button onClick={onJoin} disabled={!joinCode.trim()}>
          Войти в сессию
        </button>
        <button onClick={load}>Обновить</button>
      </div>

      {loading && <StatusBox type="info" message="Загрузка сессий..." />}
      {error && <StatusBox type="error" message={error} />}

      {!loading && !error && (
        <div className="list-grid">
          {sessions.length === 0 && <StatusBox type="info" message="Сессий пока нет" />}
          {sessions.map((session) => (
            <div className="list-item" key={session.id}>
              <div>
                <strong>{session.name}</strong>
                <div>Роль: {roleLabel(session.role)}</div>
                <div>Статус ГМа: {session.hasActiveGm ? 'активен' : 'нет активного ГМа'}</div>
                <div>Код входа: {session.joinCode}</div>
                <div>Игроки: {session.playersCount} · Персонажи: {session.charactersCount}</div>
              </div>
              <div className="inline-row">
                <button onClick={() => navigate(`/sessions/${session.id}`)}>Открыть</button>
                {session.role === 'GM' && (
                  <button disabled={deletingId === session.id} onClick={() => onDelete(session.id)}>
                    {deletingId === session.id ? 'Удаление...' : 'Удалить'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
