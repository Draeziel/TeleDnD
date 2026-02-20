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

type StatusPreset = {
  key: string;
  label: string;
  defaultDuration: string;
};

const STATUS_PRESETS: StatusPreset[] = [
  { key: 'poisoned', label: 'Отравлен', defaultDuration: '1 раунд' },
  { key: 'cursed', label: 'Проклят', defaultDuration: '1 минута' },
  { key: 'stunned', label: 'Оглушен', defaultDuration: '1 раунд' },
];

const STATUS_COLOR_BY_KEY: Record<string, string> = {
  poisoned: 'status-dot-poisoned',
  poisoneded: 'status-dot-poisoned',
  cursed: 'status-dot-cursed',
  stunned: 'status-dot-stunned',
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
  const [removingMonsterId, setRemovingMonsterId] = useState<string | null>(null);
  const [rollingCharacters, setRollingCharacters] = useState(false);
  const [rollingMonsters, setRollingMonsters] = useState(false);
  const [rollingSelfId, setRollingSelfId] = useState<string | null>(null);
  const [initiativeActionLoading, setInitiativeActionLoading] = useState(false);
  const [encounterActionLoading, setEncounterActionLoading] = useState(false);
  const [undoActionLoading, setUndoActionLoading] = useState(false);
  const [copyingCode, setCopyingCode] = useState(false);
  const [showAttachCharacters, setShowAttachCharacters] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [combatInterfaceRequested, setCombatInterfaceRequested] = useState(false);
  const [showMonsterAddControls, setShowMonsterAddControls] = useState(false);
  const [activeCombatPanelKey, setActiveCombatPanelKey] = useState<string | null>(null);
  const [effectTypeInput, setEffectTypeInput] = useState('');
  const [effectDurationInput, setEffectDurationInput] = useState('1 раунд');
  const [effectApplyingKey, setEffectApplyingKey] = useState<string | null>(null);
  const [toastNotifications, setToastNotifications] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>>([]);
  const [uiJournal, setUiJournal] = useState<Array<{ id: string; message: string; createdAt: string }>>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characterArmorClass, setCharacterArmorClass] = useState<Record<string, number | null>>({});
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [silentPollFailures, setSilentPollFailures] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const formatErrorMessage = (fallback: string, unknownError: unknown) => {
    const responsePayload = (unknownError as { response?: { data?: { message?: string; requestId?: string } } })?.response?.data;
    const requestId = responsePayload?.requestId;
    let backendMessage = typeof responsePayload?.message === 'string' ? responsePayload.message.trim() : '';

    if (backendMessage.startsWith('Validation:')) {
      backendMessage = backendMessage.replace('Validation:', '').trim();
    } else if (backendMessage.startsWith('Forbidden:')) {
      backendMessage = backendMessage.replace('Forbidden:', '').trim();
    }

    if (backendMessage) {
      return requestId ? `${backendMessage} (requestId: ${requestId})` : backendMessage;
    }

    if (requestId) {
      return `${fallback} (requestId: ${requestId})`;
    }

    return fallback;
  };

  const notify = (type: 'success' | 'error' | 'info', message: string, addToJournal = true) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToastNotifications((prev) => [...prev, { id, type, message }]);

    if (addToJournal) {
      setUiJournal((prev) => [
        {
          id,
          message,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    setTimeout(() => {
      setToastNotifications((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  };

  const normalizeStatusKey = (effectType: string) => effectType.trim().toLowerCase();

  const getStatusDotClassName = (effectType: string) => {
    const normalized = normalizeStatusKey(effectType);
    const colorClass = STATUS_COLOR_BY_KEY[normalized] || '';
    return colorClass ? `status-dot ${colorClass}` : 'status-dot';
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
      monsters: summary.monsters.map((monster) => {
        const normalizedTemplate = (monster as SessionDetails['monsters'][number] & { monsterTemplate?: SessionDetails['monsters'][number]['template'] }).template
          ?? (monster as SessionDetails['monsters'][number] & { monsterTemplate?: SessionDetails['monsters'][number]['template'] }).monsterTemplate
          ?? null;

        return {
          ...monster,
          template: normalizedTemplate,
        };
      }),
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

      setIsOffline(false);
      setIsReconnecting(false);
      setLastSyncAt(new Date());
      if (error) {
        setError('');
      }
      if (silent) {
        setSilentPollFailures(0);
      }
    } catch (unknownError) {
      const networkError = Boolean((unknownError as { isNetworkError?: boolean })?.isNetworkError);
      const offlineNow = typeof navigator !== 'undefined' ? !navigator.onLine : false;

      if (networkError || offlineNow) {
        setIsOffline(offlineNow || networkError);
        setIsReconnecting(true);
      }

      if (silent) {
        setSilentPollFailures((prev) => Math.min(prev + 1, 6));
      }

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
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedulePoll = () => {
      if (cancelled) {
        return;
      }

      const baseInterval = 7000;
      const backoffInterval = Math.min(baseInterval * (2 ** Math.min(silentPollFailures, 2)), 28000);
      timer = setTimeout(async () => {
        await load(true);
        schedulePoll();
      }, backoffInterval);
    };

    schedulePoll();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [id, silentPollFailures]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setIsReconnecting(true);
      void load(true);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setIsReconnecting(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const missingAcIds = session.characters
      .map((entry) => entry.character.id)
      .filter((characterId) => !(characterId in characterArmorClass));

    if (missingAcIds.length === 0) {
      return;
    }

    let cancelled = false;

    Promise.all(
      missingAcIds.map(async (characterId) => {
        try {
          const sheet = await characterApi.getCharacterSheet(characterId);
          return {
            characterId,
            armorClass: sheet.derivedStats.armorClass,
          };
        } catch {
          return {
            characterId,
            armorClass: null,
          };
        }
      })
    ).then((items) => {
      if (cancelled) {
        return;
      }

      setCharacterArmorClass((prev) => {
        const next = { ...prev };
        items.forEach((item) => {
          next[item.characterId] = item.armorClass;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [session, characterArmorClass]);

  const onAttachCharacter = async (characterId: string) => {
    try {
      setAttachingId(characterId);
      await sessionApi.attachCharacter(id, characterId);
      await load();
      notify('success', 'Персонаж добавлен в сессию');
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось добавить персонажа в сессию', unknownError));
    } finally {
      setAttachingId(null);
    }
  };

  const onRemoveCharacter = async (characterId: string) => {
    try {
      setRemovingId(characterId);
      const result = await sessionApi.removeCharacter(id, characterId);
      await load();
      notify('success', result.message || 'Персонаж удалён из сессии');
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось убрать персонажа из сессии', unknownError));
    } finally {
      setRemovingId(null);
    }
  };

  const onSetHp = async (characterId: string, hp: number) => {
    try {
      await sessionApi.setHp(id, characterId, hp);
      await load();
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось изменить HP (нужна роль GM)', unknownError));
    }
  };

  const onSetMonsterHp = async (monsterId: string, hp: number) => {
    try {
      await sessionApi.setMonsterHp(id, monsterId, hp);
      await load();
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось изменить HP монстра (нужна роль GM)', unknownError));
    }
  };

  const onSetInitiative = async (characterId: string, initiative: number) => {
    try {
      await sessionApi.setInitiative(id, characterId, initiative);
      await load();
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось изменить инициативу (нужна роль GM)', unknownError));
    }
  };

  const onRollInitiativeCharacters = async () => {
    try {
      setRollingCharacters(true);
      const result = await sessionApi.rollInitiativeCharacters(id);
      await load();
      notify('success', `Инициатива брошена для ${result.rolledCount} персонажей`);
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось выполнить бросок инициативы для персонажей (нужна роль GM)', unknownError));
    } finally {
      setRollingCharacters(false);
    }
  };

  const onRollInitiativeMonsters = async () => {
    try {
      setRollingMonsters(true);
      const result = await sessionApi.rollInitiativeMonsters(id);
      await load();
      notify('success', `Инициатива брошена для ${result.rolledCount} монстров`);
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось выполнить бросок инициативы для монстров (нужна роль GM)', unknownError));
    } finally {
      setRollingMonsters(false);
    }
  };

  const onRollInitiativeSelf = async (characterId: string) => {
    try {
      setRollingSelfId(characterId);
      const result = await sessionApi.rollInitiativeSelf(id, characterId);
      await load();
      notify('success', `${result.characterName}: бросок ${result.roll}${result.dexModifier >= 0 ? '+' : ''}${result.dexModifier} = ${result.initiative}`);
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось выполнить личный бросок инициативы (доступно только владельцу персонажа)', unknownError));
    } finally {
      setRollingSelfId(null);
    }
  };

  const onLockInitiative = async () => {
    try {
      setInitiativeActionLoading(true);
      await sessionApi.lockInitiative(id);
      await load();
      notify('success', 'Инициатива зафиксирована (lock)');
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось зафиксировать инициативу (нужна роль GM)', unknownError));
    } finally {
      setInitiativeActionLoading(false);
    }
  };

  const onUnlockInitiative = async () => {
    try {
      setInitiativeActionLoading(true);
      await sessionApi.unlockInitiative(id);
      await load();
      notify('success', 'Lock инициативы снят');
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось снять lock инициативы (нужна роль GM)', unknownError));
    } finally {
      setInitiativeActionLoading(false);
    }
  };

  const onResetInitiative = async () => {
    try {
      setInitiativeActionLoading(true);
      const result = await sessionApi.resetInitiative(id);
      await load();
      notify('success', `Инициатива сброшена для ${result.resetCount} персонажей`);
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось сбросить инициативу (нужна роль GM)', unknownError));
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
      notify('success', 'Код входа скопирован');
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось скопировать код входа', unknownError));
    } finally {
      setCopyingCode(false);
    }
  };

  const onStartEncounter = async () => {
    try {
      setEncounterActionLoading(true);
      const result = await sessionApi.startEncounter(id);
      await load();
      notify('success', `Encounter запущен. Раунд ${result.combatRound}`);
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось начать encounter', unknownError));
    } finally {
      setEncounterActionLoading(false);
    }
  };

  const onNextTurn = async () => {
    try {
      setEncounterActionLoading(true);
      const result = await sessionApi.nextEncounterTurn(id);
      await load();
      notify('success', `Ход передан. Текущий раунд: ${result.combatRound}`);
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось передать ход (нужна роль GM и активный encounter)', unknownError));
    } finally {
      setEncounterActionLoading(false);
    }
  };

  const onEndEncounter = async () => {
    try {
      setEncounterActionLoading(true);
      await sessionApi.endEncounter(id);
      await load();
      setCombatInterfaceRequested(false);
      notify('success', 'Encounter завершён');
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось завершить encounter (нужна роль GM)', unknownError));
    } finally {
      setEncounterActionLoading(false);
    }
  };

  const onUndoLastCombatAction = async () => {
    try {
      setUndoActionLoading(true);
      const result = await sessionApi.undoLastCombatAction(id);
      await load();
      notify('success', result.message);
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось отменить последнее боевое действие (нужна роль GM)', unknownError));
    } finally {
      setUndoActionLoading(false);
    }
  };

  const onAddMonsters = async () => {
    if (!selectedMonsterTemplateId) {
      return;
    }

    try {
      setAddingMonsters(true);
      const result = await sessionApi.addSessionMonsters(id, selectedMonsterTemplateId, monsterQuantity);
      await load();
      notify('success', `Добавлено ${result.addedCount} монстр(ов): ${result.templateName}`);
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось добавить монстров в сессию', unknownError));
    } finally {
      setAddingMonsters(false);
    }
  };

  const onApplyCombatEffect = async (characterId: string, characterName: string, panelKey: string) => {
    const effectType = effectTypeInput.trim();
    const duration = effectDurationInput.trim() || '1 раунд';

    if (!effectType) {
      notify('error', 'Укажите тип эффекта');
      return;
    }

    try {
      setEffectApplyingKey(panelKey);
      await sessionApi.applyEffect(id, characterId, effectType, duration, {});
      await load();
      notify('success', `Эффект ${effectType} применён к ${characterName}`);
      setEffectTypeInput('');
      setEffectDurationInput('1 раунд');
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось применить эффект (нужна роль GM)', unknownError));
    } finally {
      setEffectApplyingKey(null);
    }
  };

  const onRemoveMonster = async (monsterId: string) => {
    try {
      setRemovingMonsterId(monsterId);
      const result = await sessionApi.removeSessionMonster(id, monsterId);
      await load();
      notify('success', result.message || 'Монстр удалён из сессии');
    } catch (unknownError) {
      notify('error', formatErrorMessage('Не удалось удалить монстра из сессии', unknownError));
    } finally {
      setRemovingMonsterId(null);
    }
  };

  const attachedCharacterIds = new Set((session?.characters || []).map((entry) => entry.character.id));
  const availableCharacters = myCharacters.filter((character) => !attachedCharacterIds.has(character.id));
  const getAvatarInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '?';
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  };

  const initiativeQueue = [
    ...(session?.characters || [])
      .filter((entry) => entry.state?.initiative !== null && entry.state?.initiative !== undefined)
      .map((entry) => ({
        kind: 'character' as const,
        id: entry.id,
        characterId: entry.character.id,
        name: entry.character.name,
        initiative: entry.state?.initiative ?? -999,
        currentHp: entry.state?.currentHp ?? 0,
        maxHp: entry.state?.maxHpSnapshot ?? null,
        armorClass: characterArmorClass[entry.character.id] ?? null,
        avatarText: getAvatarInitials(entry.character.name),
        isActive: session?.activeTurnSessionCharacterId === entry.id,
      })),
    ...(session?.monsters || [])
      .filter((monster) => monster.initiative !== null && monster.initiative !== undefined)
      .map((monster) => ({
        kind: 'monster' as const,
        id: monster.id,
        name: monster.nameSnapshot,
        initiative: monster.initiative ?? -999,
        currentHp: monster.currentHp,
        maxHp: monster.maxHpSnapshot,
        armorClass: monster.template?.armorClass ?? null,
        avatarText: '👾',
        iconUrl: monster.template?.iconUrl || null,
        isActive: session?.activeTurnSessionCharacterId === monster.id,
      })),
  ].sort((left, right) => {
    if (right.initiative !== left.initiative) {
      return right.initiative - left.initiative;
    }

    return left.name.localeCompare(right.name);
  });
  const myRole = session?.players.find((player) => player.user.telegramId === userId)?.role || 'PLAYER';
  const isGmViewer = myRole === 'GM';
  const selectedCharacter = session?.characters.find((entry) => entry.character.id === selectedCharacterId) || null;
  const isCombatInterfaceOpen = (session?.encounterActive || false) || combatInterfaceRequested;
  const activeCombatPanelEntry = activeCombatPanelKey
    ? initiativeQueue.find((entry) => `${entry.kind}:${entry.id}` === activeCombatPanelKey) || null
    : null;
  const activeCombatPanelKeyValue = activeCombatPanelEntry ? `${activeCombatPanelEntry.kind}:${activeCombatPanelEntry.id}` : '';
  const lastSyncSecondsAgo = lastSyncAt ? Math.max(0, Math.floor((nowTick - lastSyncAt.getTime()) / 1000)) : null;

  useEffect(() => {
    if (!activeCombatPanelKey) {
      return;
    }

    const exists = initiativeQueue.some((entry) => `${entry.kind}:${entry.id}` === activeCombatPanelKey);
    if (!exists) {
      setActiveCombatPanelKey(null);
    }
  }, [activeCombatPanelKey, initiativeQueue]);

  if (loading && !session) return <StatusBox type="info" message="Загрузка сессии..." />;
  if (!session) return <StatusBox type="info" message="Сессия не найдена" />;

  return (
    <div className="page-stack">
      {toastNotifications.length > 0 && (
        <div className="toast-stack">
          {toastNotifications.map((toast) => (
            <div key={toast.id} className={`toast-item ${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}

      <div className="section-card session-header-card">
        <div className="session-head-row">
          <div className="session-head-left">
            <button
              className="btn btn-inline"
              aria-label="Обновить сессию"
              onClick={() => load()}
            >
              {loading ? `${session.name} (обновление...)` : session.name}
            </button>
          </div>
          <div className="session-head-right">
            <span className="meta-row">Код входа:</span>
            <button
              className="btn btn-inline"
              aria-label="Скопировать код входа"
              onClick={onCopyJoinCode}
            >
              {copyingCode ? 'копируем...' : session.joinCode}
            </button>
          </div>
        </div>
        <div className="session-summary-chips">
          <span className="session-chip session-chip-role" title={isGmViewer ? 'Мастер' : 'Игрок'}>
            {isGmViewer ? '♛ GM' : '🧑 Игрок'}
          </span>
          <span className="session-chip session-chip-players" title={`Игроков: ${session.playersCount ?? session.players.length}`}>
            👥 {session.playersCount ?? session.players.length}
          </span>
          {lastSyncSecondsAgo !== null && (
            <span className="session-chip" title="Последняя успешная синхронизация">
              ⟳ {lastSyncSecondsAgo}с
            </span>
          )}
        </div>
      </div>

      {!session.hasActiveGm && (
        <StatusBox
          type="info"
          message="В сессии сейчас нет активного ГМа. GM-действия временно недоступны."
        />
      )}

      {isOffline && (
        <StatusBox
          type="info"
          message="Нет сети. Пытаемся переподключиться…"
        />
      )}

      {!isOffline && isReconnecting && (
        <StatusBox
          type="info"
          message="Связь восстанавливается, обновление данных продолжается…"
        />
      )}

      {error && <StatusBox type="error" message={error} />}

      {isCombatInterfaceOpen ? (
        <div className="section-card">
          <div className="combat-head-row">
            <h2>Бой</h2>
            {session.encounterActive && (
              <button
                className="btn btn-inline"
                aria-label="Завершить бой"
                disabled={!session.hasActiveGm || encounterActionLoading}
                onClick={() => {
                  if (!session.hasActiveGm || encounterActionLoading) {
                    return;
                  }

                  void onEndEncounter();
                }}
              >
                Завершить бой
              </button>
            )}
          </div>
          <div className="list-item">
            <div>
              <div className="initiative-controls" style={{ marginTop: '2px' }}>
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
                  disabled={rollingCharacters || rollingMonsters || !session.hasActiveGm || session.initiativeLocked}
                  aria-label="Бросок инициативы для персонажей"
                  onClick={onRollInitiativeCharacters}
                >
                  {rollingCharacters ? '🎲…' : '🎲🧑'}
                </button>
                <button
                  className="btn btn-compact btn-secondary"
                  disabled={rollingCharacters || rollingMonsters || !session.hasActiveGm || session.initiativeLocked}
                  aria-label="Бросок инициативы для монстров"
                  onClick={onRollInitiativeMonsters}
                >
                  {rollingMonsters ? '🎲…' : '🎲👾'}
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
              <div style={{ marginTop: '8px' }}>
                {!session.encounterActive && (
                  <button
                    className="btn btn-inline"
                    aria-label="Начать сражение"
                    onClick={() => {
                      if (!session.hasActiveGm || encounterActionLoading) {
                        return;
                      }

                      void onStartEncounter();
                    }}
                  >
                    ▶ Начать сражение
                  </button>
                )}
              </div>
              <div className="inline-row" style={{ marginTop: '8px' }}>
                {isGmViewer && (
                  <button
                    className="btn btn-secondary btn-icon"
                    aria-label="Открыть добавление монстров"
                    title="Добавить монстров"
                    disabled={addingMonsters}
                    onClick={() => setShowMonsterAddControls((current) => !current)}
                  >
                    👾➕
                  </button>
                )}
              </div>

              {isGmViewer && showMonsterAddControls && (
                <div className="monster-add-row" style={{ marginTop: '8px' }}>
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
                    className="monster-qty-input"
                    type="number"
                    min={1}
                    max={30}
                    value={monsterQuantity}
                    onChange={(event) => setMonsterQuantity(Math.min(30, Math.max(1, Number(event.target.value) || 1)))}
                  />
                  <button
                    className="btn btn-primary btn-icon"
                    aria-label="Подтвердить добавление монстров"
                    title="Добавить"
                    disabled={addingMonsters || !selectedMonsterTemplateId}
                    onClick={onAddMonsters}
                  >
                    {addingMonsters ? '…' : '➕'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {!session.encounterActive && (
            <>
              <h2>Участники</h2>
              <div className="combat-actors-grid">
                {session.characters.map((entry) => (
                  <div className="combat-actor-card combat-actor-character" key={`precombat-character-${entry.id}`}>
                    <span className="combat-actor-badge character">ПЕРС</span>
                    <div className="combat-actor-title">{entry.character.name}</div>
                    <div className="combat-actor-icon">{getAvatarInitials(entry.character.name)}</div>
                    <div className="combat-actor-meta">❤️ {entry.state?.currentHp ?? 0} / {entry.state?.maxHpSnapshot ?? '—'}</div>
                    <div className="combat-actor-meta">🛡 {characterArmorClass[entry.character.id] ?? '—'}</div>
                    <div className="combat-actor-meta">🎲 {entry.state?.initiative ?? '—'}</div>
                    <button
                      className="btn btn-danger btn-icon combat-actor-remove"
                      aria-label={`Удалить ${entry.character.name}`}
                      disabled={removingId === entry.character.id}
                      onClick={() => onRemoveCharacter(entry.character.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {session.monsters.map((monster) => (
                  <div className="combat-actor-card combat-actor-monster" key={`precombat-monster-${monster.id}`}>
                    <span className="combat-actor-badge monster">МОН</span>
                    <div className="combat-actor-title">{monster.nameSnapshot}</div>
                    {monster.template?.iconUrl ? (
                      <img className="combat-actor-image" src={monster.template.iconUrl} alt={monster.nameSnapshot} />
                    ) : (
                      <div className="combat-actor-icon">👾</div>
                    )}
                    <div className="combat-actor-meta">❤️ {monster.currentHp} / {monster.maxHpSnapshot}</div>
                    <div className="combat-actor-meta">🛡 {monster.template?.armorClass ?? '—'}</div>
                    <div className="combat-actor-meta">🎲 {monster.initiative ?? '—'}</div>
                    {isGmViewer && (
                      <div className="inline-row">
                        <button
                          className="btn btn-secondary"
                          disabled={!session.hasActiveGm}
                          onClick={() => onSetMonsterHp(monster.id, Math.max(monster.currentHp - 1, 0))}
                        >
                          HP -1
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={!session.hasActiveGm}
                          onClick={() => onSetMonsterHp(monster.id, monster.currentHp + 1)}
                        >
                          HP +1
                        </button>
                      </div>
                    )}
                    {isGmViewer && (
                      <button
                        className="btn btn-danger btn-icon combat-actor-remove"
                        aria-label={`Удалить ${monster.nameSnapshot}`}
                        disabled={removingMonsterId === monster.id}
                        onClick={() => onRemoveMonster(monster.id)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {session.encounterActive && (
            <>
              <div className="combat-turn-head">
                <strong>Р:{session.combatRound}</strong>
                <h2>Порядок ходов</h2>
                <div className="inline-row">
                  <button
                    className="btn btn-secondary btn-icon"
                    disabled={undoActionLoading || !session.hasActiveGm}
                    aria-label="Отменить последнее боевое действие"
                    title="Отменить последнее боевое действие"
                    onClick={onUndoLastCombatAction}
                  >
                    ↩
                  </button>
                  <button
                    className="btn btn-primary btn-icon"
                    disabled={encounterActionLoading || !session.hasActiveGm}
                    aria-label="Передать ход"
                    title="Передать ход"
                    onClick={onNextTurn}
                  >
                    ⏭
                  </button>
                </div>
              </div>
              {initiativeQueue.length === 0 ? (
                <StatusBox type="info" message="Инициатива пока не выставлена" />
              ) : (
                <div className="combat-turn-grid">
                  {initiativeQueue.map((entry, index) => (
                    <div className={`combat-actor-card combat-turn-card ${entry.kind === 'character' ? 'combat-actor-character' : 'combat-actor-monster'} ${entry.isActive ? 'active-turn' : ''}`} key={`initiative-${entry.kind}-${entry.id}`}>
                      {(() => {
                        const panelKey = `${entry.kind}:${entry.id}`;

                        return (
                          <>
                      <span className={`combat-actor-badge ${entry.kind === 'character' ? 'character' : 'monster'}`}>
                        {entry.kind === 'character' ? 'ПЕРС' : 'МОН'}
                      </span>
                      <div className="combat-actor-title">
                        {entry.isActive ? '▶ ' : ''}{index + 1}. {entry.name}
                      </div>
                      {entry.kind === 'monster' && entry.iconUrl ? (
                        <img className="combat-actor-image" src={entry.iconUrl} alt={entry.name} />
                      ) : (
                        <div className="combat-actor-icon">{entry.avatarText}</div>
                      )}
                      {isGmViewer ? (
                        <button
                          className="btn btn-inline combat-hp-toggle"
                          onClick={() => {
                            setActiveCombatPanelKey((current) => (current === panelKey ? null : panelKey));
                            if (activeCombatPanelKey !== panelKey) {
                              setEffectTypeInput('');
                              setEffectDurationInput('1 раунд');
                            }
                          }}
                        >
                          ❤️ {entry.currentHp} / {entry.maxHp ?? '—'}
                        </button>
                      ) : (
                        <div className="combat-actor-meta">❤️ {entry.currentHp} / {entry.maxHp ?? '—'}</div>
                      )}
                      <div className="combat-actor-meta">🛡 {entry.armorClass ?? '—'}</div>
                      <div className="combat-actor-meta">🎲 {entry.initiative}</div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}

              {isGmViewer && activeCombatPanelEntry && (
                <div className="combat-modal-backdrop" onClick={() => setActiveCombatPanelKey(null)}>
                  <div className="combat-modal" onClick={(event) => event.stopPropagation()}>
                    <div className="combat-modal-head">
                      <strong>{activeCombatPanelEntry.name}</strong>
                      <button className="btn btn-secondary btn-icon" onClick={() => setActiveCombatPanelKey(null)} aria-label="Закрыть окно">
                        ✕
                      </button>
                    </div>

                    <div className="combat-modal-meta">
                      ❤️ {activeCombatPanelEntry.currentHp} / {activeCombatPanelEntry.maxHp ?? '—'}
                    </div>

                    <div className="inline-row">
                      {activeCombatPanelEntry.kind === 'character' ? (
                        <>
                          <button
                            className="btn btn-secondary"
                            disabled={!session.hasActiveGm || !activeCombatPanelEntry.characterId}
                            onClick={() => onSetHp(activeCombatPanelEntry.characterId as string, Math.max(activeCombatPanelEntry.currentHp - 1, 0))}
                          >
                            HP -1
                          </button>
                          <button
                            className="btn btn-secondary"
                            disabled={!session.hasActiveGm || !activeCombatPanelEntry.characterId}
                            onClick={() => onSetHp(activeCombatPanelEntry.characterId as string, activeCombatPanelEntry.currentHp + 1)}
                          >
                            HP +1
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-secondary"
                            disabled={!session.hasActiveGm}
                            onClick={() => onSetMonsterHp(activeCombatPanelEntry.id, Math.max(activeCombatPanelEntry.currentHp - 1, 0))}
                          >
                            HP -1
                          </button>
                          <button
                            className="btn btn-secondary"
                            disabled={!session.hasActiveGm}
                            onClick={() => onSetMonsterHp(activeCombatPanelEntry.id, activeCombatPanelEntry.currentHp + 1)}
                          >
                            HP +1
                          </button>
                        </>
                      )}
                    </div>

                    {activeCombatPanelEntry.kind === 'character' && activeCombatPanelEntry.characterId && (
                      <div className="combat-modal-body">
                        <div className="status-preset-row">
                          {STATUS_PRESETS.map((preset) => (
                            <button
                              key={preset.key}
                              className={`btn btn-secondary btn-compact status-preset-btn ${STATUS_COLOR_BY_KEY[preset.key] || ''}`}
                              disabled={effectApplyingKey === activeCombatPanelKeyValue || !session.hasActiveGm}
                              onClick={() => {
                                setEffectTypeInput(preset.key);
                                setEffectDurationInput((current) => current.trim() ? current : preset.defaultDuration);
                              }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <input
                          value={effectTypeInput}
                          onChange={(event) => setEffectTypeInput(event.target.value)}
                          placeholder="Эффект (например, poisoned)"
                          disabled={effectApplyingKey === activeCombatPanelKey || !session.hasActiveGm}
                        />
                        <input
                          value={effectDurationInput}
                          onChange={(event) => setEffectDurationInput(event.target.value)}
                          placeholder="Длительность"
                          disabled={effectApplyingKey === activeCombatPanelKey || !session.hasActiveGm}
                        />
                        <button
                          className="btn btn-secondary"
                          disabled={effectApplyingKey === activeCombatPanelKeyValue || !session.hasActiveGm}
                          onClick={() => onApplyCombatEffect(activeCombatPanelEntry.characterId as string, activeCombatPanelEntry.name, activeCombatPanelKeyValue)}
                        >
                          {effectApplyingKey === activeCombatPanelKeyValue ? 'Применение...' : 'Добавить статус'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <button
          className="btn btn-primary combat-start-button"
          disabled={!session.hasActiveGm}
          aria-label="Начать бой"
          onClick={() => {
            if (!session.hasActiveGm) {
              return;
            }

            setCombatInterfaceRequested(true);
          }}
        >
          Начать бой!
        </button>
      )}

      {!isCombatInterfaceOpen && (
      <div className="section-card">
        <h2>{session.encounterActive ? 'Персонажи в бою' : 'Персонажи группы'}</h2>
        {session.characters.length === 0 && <StatusBox type="info" message="Персонажи пока не добавлены" />}

        {!session.encounterActive && session.characters.length > 0 && (
          <>
            <div className="character-board-grid">
              {session.characters.map((entry) => {
                const currentHp = entry.state?.currentHp ?? 0;
                const maxHp = entry.state?.maxHpSnapshot ?? 0;
                const isDown = currentHp <= 0;
                const isOverheal = maxHp > 0 && currentHp > maxHp;
                const armorClass = characterArmorClass[entry.character.id];
                const statusIcons = entry.effects.slice(0, 3);

                return (
                  <button
                    key={entry.id}
                    className={`character-tile ${isDown ? 'is-down' : ''} ${selectedCharacterId === entry.character.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedCharacterId((current) => (current === entry.character.id ? null : entry.character.id))}
                  >
                    <div className="character-tile-statuses">
                      {statusIcons.length === 0 ? (
                        <span className="status-dot muted">•</span>
                      ) : (
                        statusIcons.map((effect) => (
                          <span key={effect.id} className={getStatusDotClassName(effect.effectType)} title={effect.effectType}>
                            {effect.effectType.slice(0, 1).toUpperCase()}
                          </span>
                        ))
                      )}
                    </div>
                    <div className="character-tile-avatar">{getAvatarInitials(entry.character.name)}</div>
                    <div className="character-tile-name">{entry.character.name}</div>
                    <div className="character-tile-bottom">
                      <span className={`tile-hp ${isOverheal ? 'overheal' : ''}`}>❤️ {currentHp}/{maxHp || '—'}</span>
                      <span className="tile-ac">🛡 {armorClass ?? '—'}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedCharacter && (
              <div className="entity-details-card">
                <div className="entity-details-title">{selectedCharacter.character.name}</div>
                <div className="meta-row">Класс: {selectedCharacter.character.class?.name || '—'}</div>
                <div className="meta-row">HP: {selectedCharacter.state?.currentHp ?? 0} / {selectedCharacter.state?.maxHpSnapshot ?? '—'}</div>
                <div className="meta-row">Инициатива: {selectedCharacter.state?.initiative ?? '—'}</div>
                <div className="meta-row">Эффекты: {selectedCharacter.effectsCount ?? selectedCharacter.effects.length}</div>
                <div className="inline-row">
                  {(() => {
                    const selfRollBlockedInEncounter = session.encounterActive && selectedCharacter.state?.initiative !== null && selectedCharacter.state?.initiative !== undefined;
                    return (
                      <>
                        <button
                          className="btn btn-danger"
                          disabled={removingId === selectedCharacter.character.id}
                          onClick={() => onRemoveCharacter(selectedCharacter.character.id)}
                        >
                          {removingId === selectedCharacter.character.id ? 'Открепление...' : 'Открепить'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={rollingSelfId === selectedCharacter.character.id || session.initiativeLocked || selfRollBlockedInEncounter}
                          onClick={() => onRollInitiativeSelf(selectedCharacter.character.id)}
                        >
                          {rollingSelfId === selectedCharacter.character.id ? 'Бросок...' : 'Бросок себе'}
                        </button>
                      </>
                    );
                  })()}
                  <button className="btn btn-secondary" disabled={!session.hasActiveGm} onClick={() => onSetHp(selectedCharacter.character.id, Math.max((selectedCharacter.state?.currentHp ?? 0) - 1, 0))}>HP -1</button>
                  <button className="btn btn-secondary" disabled={!session.hasActiveGm} onClick={() => onSetHp(selectedCharacter.character.id, (selectedCharacter.state?.currentHp ?? 0) + 1)}>HP +1</button>
                </div>
              </div>
            )}
          </>
        )}

        {session.encounterActive && (
          <div className="list-grid">
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
                    {(() => {
                      const selfRollBlockedInEncounter = session.encounterActive && entry.state?.initiative !== null && entry.state?.initiative !== undefined;
                      return (
                        <>
                          <button
                            className="btn btn-danger"
                            disabled={removingId === entry.character.id}
                            onClick={() => onRemoveCharacter(entry.character.id)}
                          >
                            {removingId === entry.character.id ? 'Открепление...' : 'Открепить'}
                          </button>
                          <button
                            className="btn btn-secondary"
                            disabled={rollingSelfId === entry.character.id || session.initiativeLocked || selfRollBlockedInEncounter}
                            onClick={() => onRollInitiativeSelf(entry.character.id)}
                          >
                            {rollingSelfId === entry.character.id ? 'Бросок...' : 'Бросок себе'}
                          </button>
                        </>
                      );
                    })()}
                    <button className="btn btn-secondary" disabled={!session.hasActiveGm} onClick={() => onSetHp(entry.character.id, Math.max(currentHp - 1, 0))}>HP -1</button>
                    <button className="btn btn-secondary" disabled={!session.hasActiveGm} onClick={() => onSetHp(entry.character.id, currentHp + 1)}>HP +1</button>
                    <button className="btn btn-secondary" disabled={!session.hasActiveGm || session.initiativeLocked} onClick={() => onSetInitiative(entry.character.id, initiative + 1)}>Иниц. +1</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {!isCombatInterfaceOpen && (
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
      )}

      {!isCombatInterfaceOpen && isGmViewer && (
        <div className="section-card">
          <div className="session-list-header">
            <h2>Журнал событий</h2>
            <button className="btn btn-secondary btn-compact" onClick={() => setShowEvents((current) => !current)}>
              {showEvents ? 'Скрыть журнал' : 'Показать журнал'}
            </button>
          </div>
          {showEvents && (
            (session.events.length + uiJournal.length) === 0 ? (
              <StatusBox type="info" message="Событий пока нет" />
            ) : (
              <div className="list-grid">
                {uiJournal.map((entry) => (
                  <div className="list-item" key={`ui-${entry.id}`}>
                    <div>
                      <strong>{entry.message}</strong>
                      <div>Кто: интерфейс</div>
                    </div>
                    <span>{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
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
