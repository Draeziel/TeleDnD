import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi';
import { StatusBox } from '../components/StatusBox';
import type { SessionListItem } from '../types/models';
import { showConfirm } from '../telegram/webApp';

export function SessionsPage() {
  const MIN_SESSION_NAME_LENGTH = 2;
  const MAX_SESSION_NAME_LENGTH = 80;

  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const roleLabel = (role: SessionListItem['role']) => (role === 'GM' ? 'Мастер' : 'Игрок');

  const formatErrorMessage = (fallback: string, unknownError: unknown) => {
    const errorResponse = (unknownError as any)?.response?.data;
    const requestId = errorResponse?.requestId;

    if (requestId) {
      return `${fallback} (requestId: ${requestId})`;
    }

    return fallback;
  };

  const load = async () => {
    try {
      if (refreshing) {
        return;
      }
      setRefreshing(true);
      setLoading(true);
      setError('');
      const data = await sessionApi.listSessions();
      setSessions(data);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось загрузить сессии. Проверьте авторизацию и доступность backend.', unknownError));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    const trimmedName = createName.trim();
    if (trimmedName.length < MIN_SESSION_NAME_LENGTH || trimmedName.length > MAX_SESSION_NAME_LENGTH) {
      setError(`Название сессии должно быть от ${MIN_SESSION_NAME_LENGTH} до ${MAX_SESSION_NAME_LENGTH} символов`);
      return;
    }

    try {
      const created = await sessionApi.createSession(trimmedName);
      setCreateName('');
      navigate(`/sessions/${created.id}`);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось создать сессию', unknownError));
    }
  };

  const onJoin = async () => {
    if (!joinCode.trim()) return;

    try {
      const joined = await sessionApi.joinSession(joinCode.trim().toUpperCase());
      setJoinCode('');
      navigate(`/sessions/${joined.sessionId}`);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось присоединиться к сессии (проверьте код)', unknownError));
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
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось удалить сессию. Удаление доступно только для ГМа.', unknownError));
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
          maxLength={MAX_SESSION_NAME_LENGTH}
          placeholder="Название сессии"
        />
        <button
          onClick={onCreate}
          disabled={createName.trim().length < MIN_SESSION_NAME_LENGTH || createName.trim().length > MAX_SESSION_NAME_LENGTH}
        >
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
        <button disabled={refreshing} onClick={load}>{refreshing ? 'Обновление...' : 'Обновить'}</button>
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
