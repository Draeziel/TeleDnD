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
  const [selectedSessionId, setSelectedSessionId] = useState('');
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
      setSelectedSessionId((current) => (current === sessionId ? '' : current));
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось удалить сессию. Удаление доступно только для ГМа.', unknownError));
    } finally {
      setDeletingId(null);
    }
  };

  const canCreate = createName.trim().length >= MIN_SESSION_NAME_LENGTH && createName.trim().length <= MAX_SESSION_NAME_LENGTH;
  const selectedSession = sessions.find((item) => item.id === selectedSessionId) || null;

  const onToggleSession = (sessionId: string) => {
    setSelectedSessionId((current) => (current === sessionId ? '' : sessionId));
  };

  return (
    <div className="page-stack">
      <div className="section-card">
        <h2>Сессии</h2>
        <div className="grid-2">
          <div className="form-stack">
            <div className="meta-row">Создать сессию</div>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              maxLength={MAX_SESSION_NAME_LENGTH}
              placeholder="Название сессии"
            />
            <button className="btn btn-primary" onClick={onCreate} disabled={!canCreate}>
              Создать сессию
            </button>
          </div>
          <div className="form-stack">
            <div className="meta-row">Войти по коду</div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Код входа"
            />
            <div className="inline-row">
              <button className="btn btn-primary" onClick={onJoin} disabled={!joinCode.trim()}>
                Войти
              </button>
              <button className="btn btn-secondary" disabled={refreshing} onClick={load}>
                {refreshing ? 'Обновление...' : 'Обновить'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && <StatusBox type="info" message="Загрузка сессий..." />}
      {error && <StatusBox type="error" message={error} />}

      {!loading && !error && (
        <div className="section-card">
          <h2>Список сессий</h2>
          {sessions.length === 0 && <StatusBox type="info" message="Сессий пока нет" />}
          {sessions.length > 0 && (
            <div className="entity-list">
              {sessions.map((session) => (
                <div className="entity-list-item" key={session.id}>
                  <div className="entity-list-icon placeholder">S</div>
                  <div className="entity-list-main">
                    <button className="btn btn-inline" onClick={() => onToggleSession(session.id)}>
                      {session.name}
                    </button>
                    <div className="entity-list-meta">
                      {roleLabel(session.role)} · ГМ: {session.hasActiveGm ? 'активен' : 'нет'} · Код: {session.joinCode}
                    </div>
                    <div className="entity-list-meta">Игроки: {session.playersCount} · Персонажи: {session.charactersCount}</div>
                  </div>
                  <div className="entity-list-actions">
                    <button className="btn btn-secondary btn-compact" onClick={() => navigate(`/sessions/${session.id}`)}>
                      Открыть
                    </button>
                    {session.role === 'GM' && (
                      <button className="btn btn-danger btn-compact" disabled={deletingId === session.id} onClick={() => onDelete(session.id)}>
                        {deletingId === session.id ? 'Удаление...' : 'Удалить'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedSession && (
        <div className="section-card">
          <h2>Карточка сессии</h2>
          <div className="entity-details-card">
            <div className="entity-details-title">{selectedSession.name}</div>
            <div className="meta-row">Роль: {roleLabel(selectedSession.role)}</div>
            <div className="meta-row">Статус ГМа: {selectedSession.hasActiveGm ? 'активен' : 'нет активного ГМа'}</div>
            <div className="meta-row">Код входа: {selectedSession.joinCode}</div>
            <div className="meta-row">Игроки: {selectedSession.playersCount} · Персонажи: {selectedSession.charactersCount}</div>
            <div className="inline-row">
              <button className="btn btn-primary btn-compact" onClick={() => navigate(`/sessions/${selectedSession.id}`)}>
                Открыть сессию
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
