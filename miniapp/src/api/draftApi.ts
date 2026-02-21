import { http } from './http';
import type { DraftState, FinalizeDraftResponse } from '../types/models';

export interface AbilityScorePayload {
  method: 'standard_array' | 'point_buy' | 'manual' | 'roll';
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export const draftApi = {
  async createDraft(name: string): Promise<DraftState> {
    const { data } = await http.post<DraftState>('/drafts', { name });
    return data;
  },

  async getDraft(draftId: string): Promise<DraftState> {
    const { data } = await http.get<DraftState>(`/drafts/${draftId}`);
    return data;
  },

  async setClass(draftId: string, classId: string): Promise<DraftState> {
    const { data } = await http.post<DraftState>(`/drafts/${draftId}/class`, { classId });
    return data;
  },

  async setRace(draftId: string, raceId: string): Promise<DraftState> {
    const { data } = await http.post<DraftState>(`/drafts/${draftId}/race`, { raceId });
    return data;
  },

  async setBackground(draftId: string, backgroundId: string): Promise<DraftState> {
    const { data } = await http.post<DraftState>(`/drafts/${draftId}/background`, { backgroundId });
    return data;
  },

  async setAbilityScores(draftId: string, payload: AbilityScorePayload): Promise<DraftState> {
    const { data } = await http.post<DraftState>(`/drafts/${draftId}/ability-scores`, payload);
    return data;
  },

  async saveChoice(draftId: string, choiceId: string, selectedOption: string): Promise<DraftState> {
    const { data } = await http.post<DraftState>(`/drafts/${draftId}/choices`, {
      choiceId,
      selectedOption,
    });
    return data;
  },

  async finalizeDraft(draftId: string): Promise<FinalizeDraftResponse> {
    const { data } = await http.post<FinalizeDraftResponse>(`/drafts/${draftId}/finalize`);
    return data;
  },

  async addItem(draftId: string, itemId: string): Promise<any> {
    const { data } = await http.post<any>(`/drafts/${draftId}/items`, { itemId });
    return data;
  },

  async equipItem(draftId: string, itemId: string): Promise<any> {
    const { data } = await http.post<any>(`/drafts/${draftId}/items/${itemId}/equip`);
    return data;
  },

  async unequipItem(draftId: string, itemId: string): Promise<any> {
    const { data } = await http.post<any>(`/drafts/${draftId}/items/${itemId}/unequip`);
    return data;
  },
};
