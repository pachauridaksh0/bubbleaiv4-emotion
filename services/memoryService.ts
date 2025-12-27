import { SupabaseClient } from '@supabase/supabase-js';
import { MemoryLayer } from '../types';

export class Memory5Layer {
  private supabase: SupabaseClient;
  private userId: string;

  constructor(supabaseClient: SupabaseClient, userId: string) {
    this.supabase = supabaseClient;
    this.userId = userId;
  }

  // Store memory in unified table or local storage
  async store(layer: MemoryLayer, key: string, value: any): Promise<void> {
    const contentStr = typeof value === 'string' ? value : JSON.stringify(value);

    // GUEST MODE
    if (this.userId === 'guest') {
        const memories = JSON.parse(localStorage.getItem('guest_memories') || '[]');
        const now = new Date().toISOString();
        const index = memories.findIndex((m: any) => m.layer === layer && m.metadata?.memory_key === key);
        
        if (index >= 0) {
            memories[index] = { ...memories[index], content: contentStr, updated_at: now };
        } else {
            memories.push({
                id: `guest-mem-${Date.now()}-${Math.random()}`,
                user_id: 'guest',
                layer,
                content: contentStr,
                metadata: { memory_key: key },
                created_at: now,
                updated_at: now
            });
        }
        localStorage.setItem('guest_memories', JSON.stringify(memories));
        return;
    }

    // SUPABASE MODE
    // We need to check if it exists first because we can't easily UPSERT on a jsonb field key
    const { data: existing } = await this.supabase
      .from('memories')
      .select('id')
      .eq('user_id', this.userId)
      .eq('layer', layer)
      .eq('metadata->>memory_key', key)
      .maybeSingle(); // Use maybeSingle to avoid error on 0 rows

    if (existing) {
      const { error } = await this.supabase
        .from('memories')
        .update({ 
          content: contentStr,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await this.supabase
        .from('memories')
        .insert({
          user_id: this.userId,
          layer,
          content: contentStr,
          metadata: { memory_key: key },
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    }
  }

  // Get memory from unified table or local storage
  async get(layer: MemoryLayer, key: string): Promise<any | null> {
    // GUEST MODE
    if (this.userId === 'guest') {
        const memories = JSON.parse(localStorage.getItem('guest_memories') || '[]');
        const memory = memories.find((m: any) => m.layer === layer && m.metadata?.memory_key === key);
        return memory ? memory.content : null;
    }

    // SUPABASE MODE
    const { data, error } = await this.supabase
      .from('memories')
      .select('content')
      .eq('user_id', this.userId)
      .eq('layer', layer)
      .eq('metadata->>memory_key', key)
      .maybeSingle();
    
    if (error || !data) return null;
    return data.content;
  }

  // Get all memories from layer
  async getAll(layer: MemoryLayer): Promise<Record<string, any>> {
    // GUEST MODE
    if (this.userId === 'guest') {
        const memories = JSON.parse(localStorage.getItem('guest_memories') || '[]');
        const layerMemories = memories.filter((m: any) => m.layer === layer);
        return layerMemories.reduce((acc: any, item: any) => {
            const k = item.metadata?.memory_key;
            if (k) acc[k] = item.content;
            return acc;
        }, {});
    }

    // SUPABASE MODE
    const { data, error } = await this.supabase
      .from('memories')
      .select('content, metadata')
      .eq('user_id', this.userId)
      .eq('layer', layer);
    
    if (error || !data) return {};
    
    return data.reduce((acc, item) => {
      const key = item.metadata?.memory_key;
      if (key) {
        acc[key] = item.content;
      }
      return acc;
    }, {} as Record<string, any>);
  }

  // Get context for AI (selected layers)
  async getContext(layers: MemoryLayer[]): Promise<Record<string, any>> {
    const context: Record<string, any> = {};
    
    for (const layer of layers) {
      context[layer] = await this.getAll(layer);
    }
    
    return context;
  }
}