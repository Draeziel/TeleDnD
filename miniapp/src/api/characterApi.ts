import { http } from './http';
import type { CharacterSheet, CharacterSummary, ContentEntity } from '../types/models';

export const characterApi = {
  async getCharacters(): Promise<CharacterSummary[]> {
    const { data } = await http.get<CharacterSummary[]>('/characters');
    return Array.isArray(data) ? data : [];
  },

  async getClasses(): Promise<ContentEntity[]> {
    const { data } = await http.get<ContentEntity[]>('/characters/classes');
    return Array.isArray(data) ? data : [];
  },

  async getRaces(): Promise<ContentEntity[]> {
    const { data } = await http.get<ContentEntity[]>('/characters/races');
    return Array.isArray(data) ? data : [];
  },

  async getBackgrounds(): Promise<ContentEntity[]> {
    const { data } = await http.get<ContentEntity[]>('/characters/backgrounds');
    return Array.isArray(data) ? data : [];
  },

  async getItems(): Promise<any[]> {
    const { data } = await http.get<any[]>('/characters/items/templates');
    return Array.isArray(data) ? data : [];
  },

  async getCharacterSheet(characterId: string): Promise<CharacterSheet> {
    const { data } = await http.get<CharacterSheet>(`/characters/${characterId}/sheet`);
    return data;
  },

  async deleteCharacter(characterId: string): Promise<void> {
    await http.delete(`/characters/${characterId}`);
  },
};
