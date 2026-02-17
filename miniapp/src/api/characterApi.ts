import { http } from './http';
import type { CharacterSheet, CharacterSummary, ContentEntity } from '../types/models';

export const characterApi = {
  async getCharacters(): Promise<CharacterSummary[]> {
    const { data } = await http.get<CharacterSummary[]>('/characters');
    return data;
  },

  async getClasses(): Promise<ContentEntity[]> {
    const { data } = await http.get<ContentEntity[]>('/characters/classes');
    return data;
  },

  async getRaces(): Promise<ContentEntity[]> {
    const { data } = await http.get<ContentEntity[]>('/characters/races');
    return data;
  },

  async getBackgrounds(): Promise<ContentEntity[]> {
    const { data } = await http.get<ContentEntity[]>('/characters/backgrounds');
    return data;
  },

  async getCharacterSheet(characterId: string): Promise<CharacterSheet> {
    const { data } = await http.get<CharacterSheet>(`/characters/${characterId}/sheet`);
    return data;
  },
};
