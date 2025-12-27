import { SupabaseClient } from '@supabase/supabase-js';
import { Project, Message, Plan, ProjectPlatform, Profile, Chat, ChatMode, Memory, ProjectType, MemoryLayer, AppSettings, ChatWithProjectData, PrivateMessage, Friendship, Notification } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

// Helper to extract a clean error message from various error formats.
const getErrorMessage = (error: any): string => {
    if (!error) {
        return "An unknown error occurred.";
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error.message === 'string' && error.message.trim() !== '') {
        return error.message;
    }
    if (error && typeof error.details === 'string' && error.details.trim() !== '') {
        return error.details;
    }
    if (error && typeof error.error_description === 'string' && error.error_description.trim() !== '') {
        return error.error_description;
    }
    if (error && typeof error.hint === 'string' && error.hint.trim() !== '') {
        return error.hint;
    }
    try {
        const str = JSON.stringify(error);
        if (str !== '{}') {
            return str;
        }
    } catch (e) {
        return "A non-serializable error object was thrown.";
    }
    return "An unknown error occurred.";
};

// Centralized error handler
const handleSupabaseError = (error: any, context: string): never => {
    console.error(`${context}:`, error);
    const message = getErrorMessage(error);
    if (message.includes('schema cache')) {
        throw new Error(`There was a problem syncing with the database schema. A page refresh usually fixes this.`);
    }
    if (message.includes('fetch') || message.includes('Load failed') || message.includes('NetworkError')) {
        throw new Error(`Network error: Could not connect to the database. Please check your internet connection.`);
    }
    throw new Error(`Database operation failed in ${context.toLowerCase()}. Reason: ${message}`);
};

// === App Settings ===
export const getAppSettings = async (supabase: SupabaseClient): Promise<AppSettings> => {
    const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) handleSupabaseError(error, 'Error fetching app settings');
    return data;
};

export const updateAppSettings = async (supabase: SupabaseClient, updates: Partial<Omit<AppSettings, 'id' | 'updated_at'>>): Promise<AppSettings> => {
    const { data, error } = await supabase
        .from('app_settings')
        .update(updates)
        .eq('id', 1)
        .select()
        .single();
    
    if (error) handleSupabaseError(error, 'Error updating app settings');
    return data;
};

// === Projects ===

export const getProjects = async (supabase: SupabaseClient, userId: string): Promise<Project[]> => {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) handleSupabaseError(error, 'Error fetching projects');
    return data || [];
};

export const getAllProjects = async (supabase: SupabaseClient): Promise<Project[]> => {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) handleSupabaseError(error, 'Error fetching all projects for admin');
    return data || [];
};

export const getProject = async (supabase: SupabaseClient, projectId: string): Promise<Project | null> => {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
    
    if (error) return null;
    return data;
};

export const createProject = async (supabase: SupabaseClient, userId: string, name: string, platform: ProjectPlatform, projectType: ProjectType, description?: string): Promise<Project> => {
    const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({ 
            user_id: userId,
            name,
            platform,
            description: description || 'Newly created project.',
            status: 'In Progress',
            default_model: 'gemini-2.5-flash',
            project_type: projectType,
        })
        .select()
        .single();
    
    if (projectError) handleSupabaseError(projectError, 'Error creating project');
    return projectData;
}

export const updateProject = async (supabase: SupabaseClient, projectId: string, updates: Partial<Project>): Promise<Project> => {
    const { data, error } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();

    if (error) handleSupabaseError(error, 'Error updating project');
    return data;
};

export const deleteProject = async (supabase: SupabaseClient, projectId: string): Promise<void> => {
    const { data: chats, error: chatsError } = await supabase
        .from('chats')
        .select('id')
        .eq('project_id', projectId);

    if (chatsError) handleSupabaseError(chatsError, 'Error fetching chats for project deletion');

    if (chats && chats.length > 0) {
        const chatIds = chats.map(c => c.id);
        await supabase.from('messages').delete().in('chat_id', chatIds);
        await supabase.from('chats').delete().eq('project_id', projectId);
    }

    const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

    if (projectError) handleSupabaseError(projectError, 'Error deleting project');
};

// === Chats ===

export const getAllChatsForUser = async (supabase: SupabaseClient, userId: string): Promise<ChatWithProjectData[]> => {
    const { data, error } = await supabase
        .from('chats')
        .select('*, projects(*)')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) handleSupabaseError(error, 'Error fetching all user chats');
    return (data as ChatWithProjectData[]) || [];
};

export const getChatsForProject = async (supabase: SupabaseClient, projectId: string): Promise<Chat[]> => {
    const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

    if (error) handleSupabaseError(error, 'Error fetching chats for project');
    return data || [];
};

export const createChat = async (supabase: SupabaseClient, userId: string, name: string, mode: ChatMode, projectId?: string | null): Promise<Chat> => {
    const { data, error } = await supabase
        .from('chats')
        .insert({
            project_id: projectId,
            user_id: userId,
            name: name,
            mode: mode,
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();
    
    if (error) handleSupabaseError(error, 'Error creating chat');
    return data;
};

export const updateChat = async (supabase: SupabaseClient, chatId: string, updates: Partial<Chat>): Promise<Chat> => {
    const { data, error } = await supabase
        .from('chats')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', chatId)
        .select()
        .single();
    
    if (error) handleSupabaseError(error, 'Error updating chat');
    return data;
};

export const deleteChat = async (supabase: SupabaseClient, chatId: string): Promise<void> => {
    const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);
    if (error) handleSupabaseError(error, 'Error deleting chat');
};

export const addChatParticipant = async (supabase: SupabaseClient, chatId: string, userId: string): Promise<void> => {
    // Check if table exists (mock implementation if not)
    // Assuming a 'chat_participants' table
    const { error } = await supabase.from('chat_participants').insert({ chat_id: chatId, user_id: userId });
    if (error) {
        // Fallback or ignore if table doesn't exist yet
        console.warn("Could not add chat participant (table might be missing)", error);
    }
};

// === Profiles ===

export const getUserProfile = async (supabase: SupabaseClient, userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        handleSupabaseError(error, 'Error fetching user profile');
    }
    return data;
};

export const createProfile = async (supabase: SupabaseClient, userId: string, displayName: string, avatarUrl: string): Promise<Profile> => {
    const { data, error } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            roblox_username: displayName,
            avatar_url: avatarUrl,
            roblox_id: userId,
        })
        .select()
        .single();

    if (error) handleSupabaseError(error, 'Error creating profile');
    return data;
};

export const updateProfile = async (supabase: SupabaseClient, userId: string, updates: Partial<Profile>): Promise<Profile> => {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    if (error) handleSupabaseError(error, 'Error updating profile');
    return data;
};

export const deductUserCredits = async (supabase: SupabaseClient, userId: string, amount: number): Promise<Profile> => {
    const { data, error } = await supabase.rpc('deduct_credits', { p_user_id: userId, p_amount: amount });
    if (error) handleSupabaseError(error, 'Error deducting credits');
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return profile;
}

export const getAllProfiles = async (supabase: SupabaseClient): Promise<Profile[]> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('roblox_username', { ascending: true });
        
    if (error) handleSupabaseError(error, 'Error fetching all profiles for admin');
    return data || [];
};

export const updateProfileForAdmin = async (supabase: SupabaseClient, userId: string, updates: Partial<Profile>): Promise<Profile> => {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    if (error) handleSupabaseError(error, 'Error updating profile for admin');
    return data;
};

export const deleteUser = async (supabase: SupabaseClient, userId: string): Promise<void> => {
    // Delete profile (cascade should handle the rest if configured, otherwise manual cleanup)
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) handleSupabaseError(error, 'Error deleting user profile');
};

export const incrementThinkingCount = async (supabase: SupabaseClient, userId: string): Promise<void> => {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.rpc('increment_thinking_count', {
      p_user_id: userId,
      p_date: today
    });
    if (error) {
        console.warn(`Could not increment thinking count for user ${userId}:`, error);
    }
};

// === Messages ===

export const getMessages = async (supabase: SupabaseClient, chatId: string): Promise<Message[]> => {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

    if (error) handleSupabaseError(error, 'Error fetching messages');
    return data || [];
};

export const addMessage = async (supabase: SupabaseClient, message: Omit<Message, 'id' | 'created_at'>): Promise<Message> => {
    const messageToInsert = { ...message };
    delete (messageToInsert as Partial<Message>).imageStatus;
    delete (messageToInsert as Partial<Message>).groundingMetadata; // Prevent schema error if missing

    const { data, error } = await supabase
        .from('messages')
        .insert(messageToInsert)
        .select()
        .single();
    
    if (error) handleSupabaseError(error, 'Error adding message');
    return data;
};

export const updateMessage = async (supabase: SupabaseClient, messageId: string, updates: Partial<Message>): Promise<Message> => {
    const { data, error } = await supabase
        .from('messages')
        .update(updates)
        .eq('id', messageId)
        .select()
        .single();
    if (error) handleSupabaseError(error, 'Error updating message');
    return data;
};

export const deleteMessage = async (supabase: SupabaseClient, messageId: string): Promise<void> => {
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
    if (error) handleSupabaseError(error, 'Error deleting message');
};

export const updateMessagePlan = async (supabase: SupabaseClient, messageId: string, plan: Plan): Promise<Message> => {
    const { data, error } = await supabase
        .from('messages')
        .update({ plan })
        .eq('id', messageId)
        .select()
        .single();

    if (error) handleSupabaseError(error, 'Error updating message plan');
    return data;
};

export const updateMessageClarification = async (supabase: SupabaseClient, messageId: string, clarification: any): Promise<Message> => {
    const { data, error } = await supabase
        .from('messages')
        .update({ clarification })
        .eq('id', messageId)
        .select()
        .single();
    
    if (error) handleSupabaseError(error, 'Error updating message clarification');
    return data;
};

// === Memories ===

export const extractAndSaveMemory = async (supabase: SupabaseClient, userId: string, userText: string, aiText: string, projectId?: string | null): Promise<void> => {
    const { data: profileData } = await supabase.from('profiles').select('gemini_api_key').eq('id', userId).single();
    if (!profileData?.gemini_api_key) return;

    const ai = new GoogleGenAI({ apiKey: profileData.gemini_api_key });
    const schema = {
        type: Type.OBJECT,
        properties: {
            memoriesToCreate: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        layer: { type: Type.STRING, enum: ['personal', 'project', 'codebase', 'aesthetic'] },
                        key: { type: Type.STRING },
                        value: { type: Type.STRING }
                    },
                    required: ["layer", "key", "value"]
                }
            }
        },
        required: ["memoriesToCreate"]
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Extract memories from:\nUser: "${userText}"\nAI: "${aiText}"\n\nIf important, output JSON { "memoriesToCreate": [{ "layer": "personal", "key": "...", "value": "..." }] }. Else empty array.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        const result = JSON.parse(response.text);
        if (result.memoriesToCreate) {
            for (const mem of result.memoriesToCreate) {
                await saveMemory(supabase, userId, mem.layer, mem.key, mem.value, projectId);
            }
        }
    } catch (e) { console.warn("Memory extraction failed", e); }
};

export const loadMemoriesForPrompt = async (supabase: SupabaseClient, userId: string, prompt: string, projectId?: string | null): Promise<string> => {
    const { data } = await supabase.from('memories').select('*').eq('user_id', userId);
    if (!data || data.length === 0) return "No memories found.";
    
    const relevant = data.filter(m => {
        if (m.layer === 'personal' || m.layer === 'aesthetic') return true;
        if (projectId && (m.layer === 'project' || m.layer === 'codebase')) {
            return m.metadata?.project_id === projectId;
        }
        return false;
    });
    
    return relevant.map(m => `[${m.layer.toUpperCase()}] ${m.metadata?.memory_key}: ${m.content}`).join('\n');
};

export const saveMemory = async (supabase: SupabaseClient, userId: string, layer: MemoryLayer, key: string, value: string, projectId?: string | null): Promise<Memory> => {
    const metadata: any = { memory_key: key };
    if (projectId) metadata.project_id = projectId;

    const { data: existing } = await supabase.from('memories').select('id').eq('user_id', userId).eq('layer', layer).eq('metadata->>memory_key', key).maybeSingle();
    
    let result;
    if (existing) {
        const { data } = await supabase.from('memories').update({ content: value, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single();
        result = data;
    } else {
        const { data } = await supabase.from('memories').insert({ user_id: userId, layer, content: value, metadata }).select().single();
        result = data;
    }
    return { ...result, key, value: result.content };
};

export const getMemoriesForUser = async (supabase: SupabaseClient, userId: string): Promise<Memory[]> => {
    const { data } = await supabase.from('memories').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    return (data || []).map((m: any) => ({ ...m, key: m.metadata?.memory_key || '[No Key]', value: m.content }));
};

export const updateMemory = async (supabase: SupabaseClient, memoryId: string, updates: Partial<Omit<Memory, 'id' | 'user_id' | 'created_at'>>): Promise<Memory> => {
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.value) dbUpdates.content = updates.value;
    if (updates.layer) dbUpdates.layer = updates.layer;
    if (updates.key) {
        const { data } = await supabase.from('memories').select('metadata').eq('id', memoryId).single();
        dbUpdates.metadata = { ...data?.metadata, memory_key: updates.key };
    }
    const { data } = await supabase.from('memories').update(dbUpdates).eq('id', memoryId).select().single();
    return { ...data, key: data.metadata?.memory_key, value: data.content };
};

export const deleteMemory = async (supabase: SupabaseClient, memoryId: string): Promise<void> => {
    await supabase.from('memories').delete().eq('id', memoryId);
};

// === Social Features ===

export const getFriendships = async (supabase: SupabaseClient, userId: string): Promise<Friendship[]> => {
    const { data, error } = await supabase
        .from('friendships')
        .select('*, sender:profiles!friendships_user_id_fkey(*), receiver:profiles!friendships_friend_id_fkey(*)')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');
        
    if (error) {
        console.warn("Social features not enabled or schema missing", error.message);
        return [];
    }

    return data.map((f: any) => {
        const isSender = f.user_id === userId;
        return {
            id: f.id,
            user_id: userId,
            friend_id: isSender ? f.friend_id : f.user_id,
            status: f.status,
            created_at: f.created_at,
            other_user: isSender ? f.receiver : f.sender
        };
    });
};

export const getPendingFriendRequests = async (supabase: SupabaseClient, userId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from('friendships')
        .select('*, sender:profiles!friendships_user_id_fkey(*)')
        .eq('friend_id', userId)
        .eq('status', 'pending');
    
    if (error) return [];
    return data;
};

export const getOutgoingFriendRequests = async (supabase: SupabaseClient, userId: string): Promise<Friendship[]> => {
    const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending');
    if (error) return [];
    return data;
};

export const sendFriendRequest = async (supabase: SupabaseClient, userId: string, friendId: string): Promise<void> => {
    const { error } = await supabase.from('friendships').insert({ user_id: userId, friend_id: friendId, status: 'pending' });
    if (error) throw error;
};

export const updateFriendRequest = async (supabase: SupabaseClient, friendshipId: string, status: 'accepted' | 'blocked'): Promise<void> => {
    const { error } = await supabase.from('friendships').update({ status }).eq('id', friendshipId);
    if (error) throw error;
};

export const searchUsers = async (supabase: SupabaseClient, query: string, currentUserId: string): Promise<Profile[]> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('roblox_username', `%${query}%`)
        .neq('id', currentUserId)
        .limit(20);
    
    if (error) return [];
    return data;
};

export const getPrivateMessages = async (supabase: SupabaseClient, userId: string, friendId: string): Promise<PrivateMessage[]> => {
    const { data, error } = await supabase
        .from('private_messages')
        .select('*')
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${userId})`)
        .order('created_at', { ascending: true });
        
    if (error) {
        console.warn("Private messages table might be missing");
        return [];
    }
    return data;
};

export const sendPrivateMessage = async (supabase: SupabaseClient, senderId: string, recipientId: string, content: string): Promise<void> => {
    const { error } = await supabase
        .from('private_messages')
        .insert({ sender_id: senderId, recipient_id: recipientId, content });
    if (error) throw error;
};

export const getNotifications = async (supabase: SupabaseClient, userId: string): Promise<Notification[]> => {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
    if (error) return [];
    return data;
};

export type { ChatWithProjectData };