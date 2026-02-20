import { http } from './http';
import type {
  SessionDetails,
  SessionListItem,
  SessionCharacterState,
  SessionEffect,
  SessionSummary,
  CombatSummary,
  SessionEvent,
  SessionMonster,
  SessionMonsterEffect,
} from '../types/models';

export const sessionApi = {
  async listSessions(): Promise<SessionListItem[]> {
    const { data } = await http.get<SessionListItem[]>('/sessions');
    return Array.isArray(data) ? data : [];
  },

  async createSession(name: string): Promise<SessionListItem> {
    const { data } = await http.post('/sessions', { name });
    return data as SessionListItem;
  },

  async joinSession(joinCode: string): Promise<{ sessionId: string; userId: string; role: 'GM' | 'PLAYER' }> {
    const { data } = await http.post('/sessions/join', { joinCode });
    return data as { sessionId: string; userId: string; role: 'GM' | 'PLAYER' };
  },

  async deleteSession(sessionId: string): Promise<{ message: string }> {
    const { data } = await http.delete(`/sessions/${sessionId}`);
    return data as { message: string };
  },

  async getSession(sessionId: string): Promise<SessionDetails> {
    const { data } = await http.get<SessionDetails>(`/sessions/${sessionId}`);
    return data;
  },

  async getSessionSummary(sessionId: string): Promise<SessionSummary> {
    const { data } = await http.get<SessionSummary>(`/sessions/${sessionId}/summary`);
    return data;
  },

  async getCombatSummary(sessionId: string): Promise<CombatSummary> {
    const { data } = await http.get<CombatSummary>(`/sessions/${sessionId}/combat-summary`);
    return data;
  },

  async getSessionEvents(sessionId: string, limit = 30, afterEventSeq?: string): Promise<SessionEvent[]> {
    const { data } = await http.get<SessionEvent[]>(`/sessions/${sessionId}/events`, {
      params: {
        limit,
        ...(afterEventSeq ? { after: afterEventSeq } : {}),
      },
    });
    return Array.isArray(data) ? data : [];
  },

  async executeCombatAction(
    sessionId: string,
    body: {
      idempotencyKey: string;
      actionType: string;
      payload?: Record<string, unknown>;
    }
  ): Promise<{
    actionType: string;
    result: unknown;
    combatEvents: SessionEvent[];
    idempotentReplay: boolean;
  }> {
    const { data } = await http.post(`/sessions/${sessionId}/combat/action`, body);
    return data as {
      actionType: string;
      result: unknown;
      combatEvents: SessionEvent[];
      idempotentReplay: boolean;
    };
  },

  async getSessionMonsters(sessionId: string): Promise<SessionMonster[]> {
    const { data } = await http.get<SessionMonster[]>(`/sessions/${sessionId}/monsters`);
    return Array.isArray(data) ? data : [];
  },

  async addSessionMonsters(
    sessionId: string,
    monsterTemplateId: string,
    quantity: number
  ): Promise<{ addedCount: number; templateName: string }> {
    const { data } = await http.post(`/sessions/${sessionId}/monsters`, {
      monsterTemplateId,
      quantity,
    });

    return data as { addedCount: number; templateName: string };
  },

  async removeSessionMonster(sessionId: string, monsterId: string): Promise<{ message: string; monsterId: string }> {
    const { data } = await http.delete(`/sessions/${sessionId}/monsters/${monsterId}`);
    return data as { message: string; monsterId: string };
  },

  async setMonsterHp(sessionId: string, monsterId: string, currentHp: number): Promise<SessionMonster> {
    const { data } = await http.post<SessionMonster>(`/sessions/${sessionId}/monsters/${monsterId}/set-hp`, {
      currentHp,
    });
    return data;
  },

  async attachCharacter(
    sessionId: string,
    characterId: string,
    state?: { currentHp?: number; maxHpSnapshot?: number; tempHp?: number }
  ): Promise<{ sessionCharacterId: string; sessionId: string; characterId: string; state: SessionCharacterState }> {
    const { data } = await http.post(`/sessions/${sessionId}/characters`, {
      characterId,
      ...(state || {}),
    });

    return data as {
      sessionCharacterId: string;
      sessionId: string;
      characterId: string;
      state: SessionCharacterState;
    };
  },

  async removeCharacter(sessionId: string, characterId: string): Promise<{ message: string }> {
    const { data } = await http.delete(`/sessions/${sessionId}/characters/${characterId}`);
    return data as { message: string };
  },

  async setHp(sessionId: string, characterId: string, currentHp: number, tempHp?: number): Promise<SessionCharacterState> {
    const { data } = await http.post<SessionCharacterState>(`/sessions/${sessionId}/characters/${characterId}/set-hp`, {
      currentHp,
      tempHp,
    });
    return data;
  },

  async setInitiative(sessionId: string, characterId: string, initiative: number): Promise<SessionCharacterState> {
    const { data } = await http.post<SessionCharacterState>(`/sessions/${sessionId}/characters/${characterId}/set-initiative`, {
      initiative,
    });
    return data;
  },

  async rollInitiativeAll(sessionId: string): Promise<{
    updates: Array<{
      sessionCharacterId: string;
      characterId: string;
      characterName: string;
      roll: number;
      dexModifier: number;
      initiative: number;
    }>;
    rolledCount: number;
  }> {
    const { data } = await http.post(`/sessions/${sessionId}/initiative/roll-all`);
    return data as {
      updates: Array<{
        sessionCharacterId: string;
        characterId: string;
        characterName: string;
        roll: number;
        dexModifier: number;
        initiative: number;
      }>;
      rolledCount: number;
    };
  },

  async rollInitiativeMonsters(sessionId: string): Promise<{
    updates: Array<{
      sessionMonsterId: string;
      roll: number;
      initiativeModifier: number;
      initiative: number;
    }>;
    rolledCount: number;
  }> {
    const { data } = await http.post(`/sessions/${sessionId}/initiative/roll-monsters`);
    return data as {
      updates: Array<{
        sessionMonsterId: string;
        roll: number;
        initiativeModifier: number;
        initiative: number;
      }>;
      rolledCount: number;
    };
  },

  async rollInitiativeCharacters(sessionId: string): Promise<{
    updates: Array<{
      sessionCharacterId: string;
      characterId: string;
      characterName: string;
      roll: number;
      dexModifier: number;
      initiative: number;
    }>;
    rolledCount: number;
  }> {
    const { data } = await http.post(`/sessions/${sessionId}/initiative/roll-characters`);
    return data as {
      updates: Array<{
        sessionCharacterId: string;
        characterId: string;
        characterName: string;
        roll: number;
        dexModifier: number;
        initiative: number;
      }>;
      rolledCount: number;
    };
  },

  async rollInitiativeSelf(sessionId: string, characterId: string): Promise<{
    sessionCharacterId: string;
    characterId: string;
    characterName: string;
    roll: number;
    dexModifier: number;
    initiative: number;
  }> {
    const { data } = await http.post(`/sessions/${sessionId}/initiative/roll-self`, { characterId });
    return data as {
      sessionCharacterId: string;
      characterId: string;
      characterName: string;
      roll: number;
      dexModifier: number;
      initiative: number;
    };
  },

  async lockInitiative(sessionId: string): Promise<{ initiativeLocked: boolean }> {
    const { data } = await http.post(`/sessions/${sessionId}/initiative/lock`);
    return data as { initiativeLocked: boolean };
  },

  async unlockInitiative(sessionId: string): Promise<{ initiativeLocked: boolean }> {
    const { data } = await http.post(`/sessions/${sessionId}/initiative/unlock`);
    return data as { initiativeLocked: boolean };
  },

  async resetInitiative(sessionId: string): Promise<{ resetCount: number; initiativeLocked: boolean }> {
    const { data } = await http.post(`/sessions/${sessionId}/initiative/reset`);
    return data as { resetCount: number; initiativeLocked: boolean };
  },

  async startEncounter(sessionId: string): Promise<{
    encounterActive: boolean;
    combatRound: number;
    activeTurnSessionCharacterId: string | null;
  }> {
    const { data } = await http.post(`/sessions/${sessionId}/encounter/start`);
    return data as {
      encounterActive: boolean;
      combatRound: number;
      activeTurnSessionCharacterId: string | null;
    };
  },

  async nextEncounterTurn(sessionId: string): Promise<{
    encounterActive: boolean;
    combatRound: number;
    activeTurnSessionCharacterId: string | null;
  }> {
    const { data } = await http.post(`/sessions/${sessionId}/encounter/next-turn`);
    return data as {
      encounterActive: boolean;
      combatRound: number;
      activeTurnSessionCharacterId: string | null;
    };
  },

  async undoLastCombatAction(sessionId: string): Promise<{ undoneType: string; message: string }> {
    const { data } = await http.post(`/sessions/${sessionId}/combat/undo-last`);
    return data as { undoneType: string; message: string };
  },

  async endEncounter(sessionId: string): Promise<{
    encounterActive: boolean;
    combatRound: number;
    activeTurnSessionCharacterId: string | null;
  }> {
    const { data } = await http.post(`/sessions/${sessionId}/encounter/end`);
    return data as {
      encounterActive: boolean;
      combatRound: number;
      activeTurnSessionCharacterId: string | null;
    };
  },

  async applyEffect(
    sessionId: string,
    characterId: string,
    effectType: string,
    duration: string,
    payload: Record<string, unknown>
  ): Promise<SessionEffect> {
    const { data } = await http.post<SessionEffect>(`/sessions/${sessionId}/characters/${characterId}/apply-effect`, {
      effectType,
      duration,
      payload,
    });
    return data;
  },

  async applyMonsterEffect(
    sessionId: string,
    monsterId: string,
    effectType: string,
    duration: string,
    payload: Record<string, unknown>
  ): Promise<SessionMonsterEffect> {
    const { data } = await http.post<SessionMonsterEffect>(`/sessions/${sessionId}/monsters/${monsterId}/apply-effect`, {
      effectType,
      duration,
      payload,
    });
    return data;
  },

  async removeEffect(
    sessionId: string,
    characterId: string,
    effectId: string
  ): Promise<{ removedEffectId: string; characterId: string; effectType: string }> {
    const { data } = await http.delete(`/sessions/${sessionId}/characters/${characterId}/effects/${effectId}`);
    return data as { removedEffectId: string; characterId: string; effectType: string };
  },

  async removeMonsterEffect(
    sessionId: string,
    monsterId: string,
    effectId: string
  ): Promise<{ removedEffectId: string; monsterId: string; effectType: string }> {
    const { data } = await http.delete(`/sessions/${sessionId}/monsters/${monsterId}/effects/${effectId}`);
    return data as { removedEffectId: string; monsterId: string; effectType: string };
  },
};
