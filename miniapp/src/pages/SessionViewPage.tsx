import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi';
import { characterApi } from '../api/characterApi';
import { monsterApi } from '../api/monsterApi';
import { StatusBox } from '../components/StatusBox';
import type { CharacterSummary, MonsterTemplate, SessionDetails, SessionSummary } from '../types/models';
import { useTelegram } from '../hooks/useTelegram';

type SessionCharacterView = SessionDetails['characters'][number] & { effectsCount?: number };
type SessionViewModel = Omit<SessionDetails, 'characters'> & {
  playersCount?: number;
  characters: SessionCharacterView[];
};

export function SessionViewPage() {
  const { id = '' } = useParams();
  const { userId } = useTelegram();
  const [session, setSession] = useState<SessionViewModel | null>(null);
  const [myCharacters, setMyCharacters] = useState<CharacterSummary[]>([]);
  const [monsterTemplates, setMonsterTemplates] = useState<MonsterTemplate[]>([]);
  const [selectedMonsterTemplateId, setSelectedMonsterTemplateId] = useState('');
  const [monsterQuantity, setMonsterQuantity] = useState(1);
  const [addingMonsters, setAddingMonsters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [rollingAll, setRollingAll] = useState(false);
  const [rollingSelfId, setRollingSelfId] = useState<string | null>(null);
  const [initiativeActionLoading, setInitiativeActionLoading] = useState(false);
  const [encounterActionLoading, setEncounterActionLoading] = useState(false);
  const [copyingCode, setCopyingCode] = useState(false);
  const [showAttachCharacters, setShowAttachCharacters] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const formatErrorMessage = (fallback: string, unknownError: unknown) => {
    const errorResponse = (unknownError as any)?.response?.data;
    const requestId = errorResponse?.requestId;

    if (requestId) {
      return `${fallback} (requestId: ${requestId})`;
    }

    return fallback;
  };

  const mergeSummaryIntoSession = (prev: SessionViewModel | null, summary: SessionSummary): SessionViewModel | null => {
    if (!prev) {
      return prev;
    }

    const nextCharacters: SessionCharacterView[] = summary.characters.map((characterSummary) => {
      const existing = prev.characters.find((entry) => entry.id === characterSummary.id);

      return {
        ...(existing || {
          id: characterSummary.id,
          character: characterSummary.character,
          state: null,
          effects: [],
        }),
        character: characterSummary.character,
        state: characterSummary.state,
        effectsCount: characterSummary.effectsCount,
      };
    });

    return {
      ...prev,
      name: summary.name,
      joinCode: summary.joinCode,
      updatedAt: summary.updatedAt,
      playersCount: summary.playersCount,
      initiativeLocked: summary.initiativeLocked,
      encounterActive: summary.encounterActive,
      combatRound: summary.combatRound,
      activeTurnSessionCharacterId: summary.activeTurnSessionCharacterId,
      hasActiveGm: summary.hasActiveGm,
      events: summary.events,
      monsters: summary.monsters,
      characters: nextCharacters,
    };
  };

  const load = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) {
        setLoading(true);
      }
      if (!silent) {
        setError('');
      }

      if (silent) {
        const summary = await sessionApi.getSessionSummary(id);
        setSession((prev) => mergeSummaryIntoSession(prev, summary));
      } else {
        const data = await sessionApi.getSession(id);
        setSession({
          ...data,
          playersCount: data.players.length,
          monsters: data.monsters || [],
          characters: data.characters.map((entry) => ({
            ...entry,
            effectsCount: entry.effects.length,
          })),
        });
      }
    } catch (unknownError) {
      if (!silent || !session) {
        setError(formatErrorMessage('Не удалось загрузить данные сессии', unknownError));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadMonsterTemplates = async () => {
    try {
      const payload = await monsterApi.listTemplates({ scope: 'all' });
      setMonsterTemplates(payload.items);
      setSelectedMonsterTemplateId((prev) => {
        if (prev && payload.items.some((item) => item.id === prev)) {
          return prev;
        }

        return payload.items[0]?.id || '';
      });
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось загрузить каталог монстров', unknownError));
    }
  };

  const loadMyCharacters = async () => {
    try {
      const data = await characterApi.getCharacters();
      setMyCharacters(data);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось загрузить список ваших персонажей', unknownError));
    }
  };

  useEffect(() => {
    load();
    loadMyCharacters();
    loadMonsterTemplates();
    const timer = setInterval(() => load(true), 7000);
    return () => clearInterval(timer);
  }, [id]);

  const onAttachCharacter = async (characterId: string) => {
    try {
      setAttachingId(characterId);
      setError('');
      setStatus('');
      await sessionApi.attachCharacter(id, characterId);
      await load();
      setStatus('Персонаж добавлен в сессию');
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось добавить персонажа в сессию', unknownError));
    } finally {
      setAttachingId(null);
    }
  };

  const onRemoveCharacter = async (characterId: string) => {
    try {
      setRemovingId(characterId);
      setError('');
      setStatus('');
      const result = await sessionApi.removeCharacter(id, characterId);
      await load();
      setStatus(result.message || 'Персонаж удалён из сессии');
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось убрать персонажа из сессии', unknownError));
    } finally {
      setRemovingId(null);
    }
  };

  const onSetHp = async (characterId: string, hp: number) => {
    try {
      await sessionApi.setHp(id, characterId, hp);
      await load();
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось изменить HP (нужна роль GM)', unknownError));
    }
  };

  const onSetInitiative = async (characterId: string, initiative: number) => {
    try {
      await sessionApi.setInitiative(id, characterId, initiative);
      await load();
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось изменить инициативу (нужна роль GM)', unknownError));
    }
  };

  const onRollInitiativeAll = async () => {
    try {
      setRollingAll(true);
      setError('');
      setStatus('');
      const result = await sessionApi.rollInitiativeAll(id);
      await load();
      setStatus(`Инициатива брошена для ${result.rolledCount} персонажей`);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось выполнить массовый бросок инициативы (нужна роль GM)', unknownError));
    } finally {
      setRollingAll(false);
    }
  };

  const onRollInitiativeSelf = async (characterId: string) => {
    try {
      setRollingSelfId(characterId);
      setError('');
      setStatus('');
      const result = await sessionApi.rollInitiativeSelf(id, characterId);
      await load();
      setStatus(`${result.characterName}: бросок ${result.roll}${result.dexModifier >= 0 ? '+' : ''}${result.dexModifier} = ${result.initiative}`);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось выполнить личный бросок инициативы (доступно только владельцу персонажа)', unknownError));
    } finally {
      setRollingSelfId(null);
    }
  };

  const onLockInitiative = async () => {
    try {
      setInitiativeActionLoading(true);
      setError('');
      setStatus('');
      await sessionApi.lockInitiative(id);
      await load();
      setStatus('Инициатива зафиксирована (lock)');
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось зафиксировать инициативу (нужна роль GM)', unknownError));
    } finally {
      setInitiativeActionLoading(false);
    }
  };

  const onUnlockInitiative = async () => {
    try {
      setInitiativeActionLoading(true);
      setError('');
      setStatus('');
      await sessionApi.unlockInitiative(id);
      await load();
      setStatus('Lock инициативы снят');
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось снять lock инициативы (нужна роль GM)', unknownError));
    } finally {
      setInitiativeActionLoading(false);
    }
  };

  const onResetInitiative = async () => {
    try {
      setInitiativeActionLoading(true);
      setError('');
      setStatus('');
      const result = await sessionApi.resetInitiative(id);
      await load();
      setStatus(`Инициатива сброшена для ${result.resetCount} персонажей`);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось сбросить инициативу (нужна роль GM)', unknownError));
    } finally {
      setInitiativeActionLoading(false);
    }
  };

  const onCopyJoinCode = async () => {
    try {
      if (!session?.joinCode) {
        return;
      }

      setCopyingCode(true);
      await navigator.clipboard.writeText(session.joinCode);
      setStatus('Код входа скопирован');
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось скопировать код входа', unknownError));
    } finally {
      setCopyingCode(false);
    }
  };

  const onStartEncounter = async () => {
    try {
      setEncounterActionLoading(true);
      setError('');
      setStatus('');
      const result = await sessionApi.startEncounter(id);
      await load();
      setStatus(`Encounter запущен. Раунд ${result.combatRound}`);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось начать encounter (нужна роль GM и выставленная инициатива)', unknownError));
    } finally {
      setEncounterActionLoading(false);
    }
  };

  const onNextTurn = async () => {
    try {
      setEncounterActionLoading(true);
      setError('');
      setStatus('');
      const result = await sessionApi.nextEncounterTurn(id);
      await load();
      setStatus(`Ход передан. Текущий раунд: ${result.combatRound}`);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось передать ход (нужна роль GM и активный encounter)', unknownError));
    } finally {
      setEncounterActionLoading(false);
    }
  };

  const onEndEncounter = async () => {
    try {
      setEncounterActionLoading(true);
      setError('');
      setStatus('');
      await sessionApi.endEncounter(id);
      await load();
      setStatus('Encounter завершён');
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось завершить encounter (нужна роль GM)', unknownError));
    } finally {
      setEncounterActionLoading(false);
    }
  };

  const onAddMonsters = async () => {
    if (!selectedMonsterTemplateId) {
      return;
    }

    try {
      setAddingMonsters(true);
      setError('');
      setStatus('');
      const result = await sessionApi.addSessionMonsters(id, selectedMonsterTemplateId, monsterQuantity);
      await load();
      setStatus(`Добавлено ${result.addedCount} монстр(ов): ${result.templateName}`);
    } catch (unknownError) {
      setError(formatErrorMessage('Не удалось добавить монстров в сессию', unknownError));
    } finally {
      setAddingMonsters(false);
    }
  };

  if (loading && !session) return <StatusBox type="info" message="Загрузка сессии..." />;
  if (!session) return <StatusBox type="info" message="Сессия не найдена" />;

  const attachedCharacterIds = new Set(session.characters.map((entry) => entry.character.id));
  const availableCharacters = myCharacters.filter((character) => !attachedCharacterIds.has(character.id));
  const initiativeOrder = [...session.characters]
    .filter((entry) => entry.state?.initiative !== null && entry.state?.initiative !== undefined)
    .sort((left, right) => {
      const leftInitiative = left.state?.initiative ?? -999;
      const rightInitiative = right.state?.initiative ?? -999;

      if (rightInitiative !== leftInitiative) {
        return rightInitiative - leftInitiative;
      }

      return left.character.name.localeCompare(right.character.name);
    });
  const activeTurnCharacter = session.characters.find(
    (entry) => entry.id === session.activeTurnSessionCharacterId
  );
  const activeTurnIndex = initiativeOrder.findIndex((entry) => entry.id === session.activeTurnSessionCharacterId);
  const nextTurnCharacter =
    initiativeOrder.length === 0
      ? null
      : activeTurnIndex >= 0
        ? initiativeOrder[(activeTurnIndex + 1) % initiativeOrder.length]
        : initiativeOrder[0];
  const myRole = session.players.find((player) => player.user.telegramId === userId)?.role || 'PLAYER';
  const isGmViewer = myRole === 'GM';

  return (
    <div className="page-stack">
      <div className="section-card">
        <h2
          className="session-title"
        >
          <button
            className="btn btn-inline"
            aria-label="Обновить сессию"
            onClick={() => load()}
          >
            {loading ? `${session.name} (обновление...)` : session.name}
          </button>
        </h2>
        <div>
          Код входа:{' '}
          <button
            className="btn btn-inline"
            aria-label="Скопировать код входа"
            onClick={onCopyJoinCode}
          >
            {copyingCode ? 'копируем...' : session.joinCode}
          </button>
        </div>
        <div className="session-summary-chips">
          <span className="session-chip session-chip-role" title={isGmViewer ? 'Мастер' : 'Игрок'}>
            {isGmViewer ? '♛ GM' : '🧑 Игрок'}
          </span>
          <span className="session-chip session-chip-players" title={`Игроков: ${session.playersCount ?? session.players.length}`}>
            👥 {session.playersCount ?? session.players.length}
          </span>
        </div>
        <div className="initiative-controls">
          <span>Инициатива:</span>
          <button
            className="btn btn-inline"
            disabled={!session.hasActiveGm || initiativeActionLoading}
            aria-label="Переключить lock инициативы"
            onClick={() => {
              if (!session.hasActiveGm || initiativeActionLoading) {
                return;
              }

              if (session.initiativeLocked) {
                void onUnlockInitiative();
                return;
              }

              void onLockInitiative();
            }}
          >
            {session.initiativeLocked ? '🔒' : '🔓'}
          </button>
          <button
            className="btn btn-compact btn-secondary"
            disabled={rollingAll || !session.hasActiveGm || session.initiativeLocked}
            aria-label="Бросок инициативы для всех"
            onClick={onRollInitiativeAll}
          >
            {rollingAll ? '🎲…' : '🎲 всем'}
          </button>
          <button
            className="btn btn-compact btn-secondary"
            disabled={initiativeActionLoading || !session.hasActiveGm}
            aria-label="Сбросить инициативу"
            onClick={onResetInitiative}
          >
            🎲✕
          </button>
        </div>
        <div className="list-item">
          <div>
            <strong>Combat</strong>
            <div>
              Раунд: {session.encounterActive ? session.combatRound : '—'}{' '}
              <button
                className="btn btn-inline"
                aria-label={session.encounterActive ? 'Завершить раунд' : 'Начать раунд'}
                onClick={() => {
                  if (!session.hasActiveGm || encounterActionLoading) {
                    return;
                  }

                  if (session.encounterActive) {
                    void onEndEncounter();
                    return;
                  }

                  void onStartEncounter();
                }}
              >
                {session.encounterActive ? '■ Стоп' : '▶ Старт'}
              </button>
            </div>
            <div>Текущий: {activeTurnCharacter?.character.name ?? '—'}</div>
            <div>Следующий: {nextTurnCharacter?.character.name ?? '—'}</div>
          </div>
          <button
            className="btn btn-primary"
            disabled={encounterActionLoading || !session.hasActiveGm || !session.encounterActive}
            onClick={onNextTurn}
          >
            Next turn
          </button>
        </div>
      </div>

      <div className="section-card">
        <h2>Добавление монстров</h2>
        <div className="inline-row">
          <select
            value={selectedMonsterTemplateId}
            onChange={(event) => setSelectedMonsterTemplateId(event.target.value)}
            disabled={addingMonsters || monsterTemplates.length === 0}
          >
            {monsterTemplates.length === 0 && <option value="">Нет доступных шаблонов</option>}
            {monsterTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.scope === 'GLOBAL' ? 'global' : 'personal'})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={30}
            value={monsterQuantity}
            onChange={(event) => setMonsterQuantity(Math.min(30, Math.max(1, Number(event.target.value) || 1)))}
          />
          <button
            className="btn btn-primary"
            disabled={addingMonsters || !session.hasActiveGm || !selectedMonsterTemplateId}
            onClick={onAddMonsters}
          >
            {addingMonsters ? 'Добавляем...' : 'Добавить'}
          </button>
        </div>
      </div>

      {!session.hasActiveGm && (
        <StatusBox
          type="info"
          message="В сессии сейчас нет активного ГМа. GM-действия временно недоступны."
        />
      )}

      {status && <StatusBox type="success" message={status} />}
      {error && <StatusBox type="error" message={error} />}

      <div className="section-card">
        <h2>Персонажи группы</h2>
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
                  <div>Эффекты: {entry.effectsCount ?? entry.effects.length}</div>
                </div>
                <div className="inline-row">
                  <button
                    className="btn btn-danger"
                    disabled={removingId === entry.character.id}
                    onClick={() => onRemoveCharacter(entry.character.id)}
                  >
                    {removingId === entry.character.id ? 'Открепление...' : 'Открепить'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={rollingSelfId === entry.character.id || session.initiativeLocked}
                    onClick={() => onRollInitiativeSelf(entry.character.id)}
                  >
                    {rollingSelfId === entry.character.id ? 'Бросок...' : 'Бросок себе'}
                  </button>
                  <button className="btn btn-secondary" disabled={!session.hasActiveGm} onClick={() => onSetHp(entry.character.id, Math.max(currentHp - 1, 0))}>HP -1</button>
                  <button className="btn btn-secondary" disabled={!session.hasActiveGm} onClick={() => onSetHp(entry.character.id, currentHp + 1)}>HP +1</button>
                  <button className="btn btn-secondary" disabled={!session.hasActiveGm || session.initiativeLocked} onClick={() => onSetInitiative(entry.character.id, initiative + 1)}>Иниц. +1</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-card">
        <h2>Монстры в сессии</h2>
        <div className="list-grid">
          {session.monsters.length === 0 && <StatusBox type="info" message="Монстры пока не добавлены" />}
          {session.monsters.map((monster) => (
            <div className="list-item" key={monster.id}>
              <div>
                <strong>{monster.nameSnapshot}</strong>
                <div>{monster.template ? [monster.template.size, monster.template.creatureType, monster.template.alignment].filter(Boolean).join(', ') : 'custom'}</div>
                <div>HP: {monster.currentHp} / {monster.maxHpSnapshot}</div>
                <div>Инициатива: {monster.initiative ?? '—'}</div>
              </div>
              <div className="meta-row">AC: {monster.template?.armorClass ?? '—'} • CR: {monster.template?.challengeRating || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-card">
        <h2>Порядок ходов</h2>
        {initiativeOrder.length === 0 ? (
          <StatusBox type="info" message="Инициатива пока не выставлена" />
        ) : (
          <div className="list-grid">
            {initiativeOrder.map((entry, index) => (
              <div className="list-item" key={`initiative-${entry.id}`}>
                <div>
                  <strong>{session.activeTurnSessionCharacterId === entry.id ? '▶ ' : ''}{index + 1}. {entry.character.name}</strong>
                  <div>Класс: {entry.character.class?.name || '—'}</div>
                </div>
                <span>Инициатива: {entry.state?.initiative}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="session-list-header">
          <h2>Добавить персонажа</h2>
          <button className="btn btn-secondary btn-compact" onClick={() => setShowAttachCharacters((current) => !current)}>
            {showAttachCharacters ? 'Скрыть' : '+персонаж'}
          </button>
        </div>
        {showAttachCharacters && (
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
                <button className="btn btn-primary" disabled={attachingId === character.id} onClick={() => onAttachCharacter(character.id)}>
                  {attachingId === character.id ? 'Добавление...' : 'Добавить'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isGmViewer && (
        <div className="section-card">
          <div className="session-list-header">
            <h2>Журнал событий</h2>
            <button className="btn btn-secondary btn-compact" onClick={() => setShowEvents((current) => !current)}>
              {showEvents ? 'Скрыть журнал' : 'Показать журнал'}
            </button>
          </div>
          {showEvents && (
            session.events.length === 0 ? (
              <StatusBox type="info" message="Событий пока нет" />
            ) : (
              <div className="list-grid">
                {session.events.map((event) => (
                  <div className="list-item" key={event.id}>
                    <div>
                      <strong>{event.message}</strong>
                      <div>Кто: {event.actorTelegramId}</div>
                    </div>
                    <span>{new Date(event.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
