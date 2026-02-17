import { http } from './http';
import type { SessionDetails, SessionListItem, SessionCharacterState, SessionEffect } from '../types/models';

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
};
