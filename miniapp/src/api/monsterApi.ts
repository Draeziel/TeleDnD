import { http } from './http';
import type { MonsterTemplate } from '../types/models';

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

  async createTemplate(input: {
    name: string;
    armorClass: number;
    maxHp: number;
    initiativeModifier?: number;
    challengeRating?: string;
    source?: string;
    scope?: 'GLOBAL' | 'PERSONAL';
  }): Promise<MonsterTemplate> {
    const { data } = await http.post('/monsters/templates', input);
    return data as MonsterTemplate;
  },
};
