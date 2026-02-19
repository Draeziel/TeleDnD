import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi';
import { StatusBox } from '../components/StatusBox';
import type { SessionListItem } from '../types/models';
import { showConfirm } from '../telegram/webApp';

export function SessionsPage() {
  const MIN_SESSION_NAME_LENGTH = 2;

  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copyingCodeId, setCopyingCodeId] = useState<string | null>(null);
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
    if (trimmedName.length < MIN_SESSION_NAME_LENGTH) {
      setError(`Название сессии должно быть не короче ${MIN_SESSION_NAME_LENGTH} символов`);
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

  const canCreate = createName.trim().length >= MIN_SESSION_NAME_LENGTH;

  const onCopyCode = async (session: SessionListItem) => {
    try {
      setCopyingCodeId(session.id);
      setError('');
      await navigator.clipboard.writeText(session.joinCode);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось скопировать код сессии', unknownError));
    } finally {
      setCopyingCodeId(null);
    }
  };

  return (
    <div className="page-stack">
      <div className="section-card">
        <h2>Сессии</h2>
        <div className="form-stack">
          <div className="session-input-row">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Название сессии"
            />
            <button className="btn btn-primary" onClick={onCreate} disabled={!canCreate}>
              Создать
            </button>
          </div>
          <div className="session-input-row">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Код входа"
            />
            <button className="btn btn-primary" onClick={onJoin} disabled={!joinCode.trim()}>
              Войти
            </button>
          </div>
        </div>
      </div>

      {loading && <StatusBox type="info" message="Загрузка сессий..." />}
      {error && <StatusBox type="error" message={error} />}

      {!loading && !error && (
        <div className="section-card">
          <div className="session-list-header">
            <h2>Список сессий</h2>
            <button className="btn btn-secondary btn-icon" disabled={refreshing} onClick={load} aria-label="Обновить список сессий" title="Обновить">
              {refreshing ? '…' : '↻'}
            </button>
          </div>
          {sessions.length === 0 && <StatusBox type="info" message="Сессий пока нет" />}
          {sessions.length > 0 && (
            <div className="session-list">
              {sessions.map((session) => (
                <div className="session-list-item" key={session.id}>
                  <div className="session-list-top">
                    <button className="btn btn-inline" onClick={() => navigate(`/sessions/${session.id}`)}>
                      {session.name}
                    </button>
                    <span className="session-chip session-chip-role" title={roleLabel(session.role)}>
                      {session.role === 'GM' ? '♛ GM' : '🧑 Игрок'}
                    </span>
                    <span className="session-chip session-chip-players" title={`Игроков: ${session.playersCount}`}>
                      👥 {session.playersCount}
                    </span>
                    <button
                      className="btn btn-danger btn-compact session-delete"
                      disabled={deletingId === session.id || session.role !== 'GM'}
                      onClick={() => onDelete(session.id)}
                      title={session.role === 'GM' ? 'Удалить сессию' : 'Удаление доступно только мастеру'}
                      aria-label="Удалить сессию"
                    >
                      {deletingId === session.id ? '…' : '✖'}
                    </button>
                  </div>
                  <div className="session-list-bottom">
                    <button className="btn btn-inline" onClick={() => onCopyCode(session)} title="Скопировать код входа">
                      {copyingCodeId === session.id ? 'копируем...' : session.joinCode}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
