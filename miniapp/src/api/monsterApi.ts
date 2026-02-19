import { http } from './http';
import type { MonsterTemplate } from '../types/models';

type MonsterTemplateUpsertInput = {
  name: string;
  size?: string;
  creatureType?: string;
  alignment?: string;
  armorClass: number;
  maxHp: number;
  hitDice?: string;
  speed?: string;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  initiativeModifier?: number;
  challengeRating?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  senses?: string;
  languages?: string;
  traits?: string;
  actions?: string;
  legendaryActions?: string;
  iconUrl?: string;
  imageUrl?: string;
  source?: string;
  scope?: 'GLOBAL' | 'PERSONAL';
};

export const monsterApi = {
  async listTemplates(params?: { query?: string; scope?: 'all' | 'global' | 'personal' }): Promise<{
    canManageGlobal: boolean;
    items: MonsterTemplate[];
  }> {
    const { data } = await http.get('/monsters/templates', { params });

    return {
      canManageGlobal: Boolean((data as any)?.canManageGlobal),
      items: Array.isArray((data as any)?.items) ? (data as any).items : [],
    };
  },

  async createTemplate(input: MonsterTemplateUpsertInput): Promise<MonsterTemplate> {
    const { data } = await http.post('/monsters/templates', input);
    return data as MonsterTemplate;
  },

  async updateTemplate(id: string, input: MonsterTemplateUpsertInput): Promise<MonsterTemplate> {
    const { data } = await http.put(`/monsters/templates/${id}`, input);
    return data as MonsterTemplate;
  },

  async deleteTemplate(id: string): Promise<{ success: boolean; id: string }> {
    const { data } = await http.delete(`/monsters/templates/${id}`);
    return data as { success: boolean; id: string };
  },
};
