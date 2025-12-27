
import { SupabaseClient, User } from '@supabase/supabase-js';
import { Project, Chat, Message, WorkspaceMode, Profile, Plan } from '../types';

export interface AgentInput {
    prompt: string;
    apiKey: string;
    model: string;
    project: Project;
    chat: Chat;
    user: User;
    profile: Profile | null;
    supabase: SupabaseClient;
    history: Message[];
    workspaceMode: WorkspaceMode;
    files?: File[] | null;
    // Optional, for when a plan is being generated from answers
    answers?: string[];
    // Optional callback for streaming text responses
    onStreamChunk?: (chunk: string) => void;
    // Optional callback for streaming file updates (path, content, isComplete)
    onFileUpdate?: (path: string, content: string, isComplete: boolean) => void;
    // Optional pre-fetched memory context
    memoryContext?: string;
    // Optional thinking mode flag
    thinkingMode?: 'instant' | 'fast' | 'think' | 'deep';
    // Signal to abort generation
    signal?: AbortSignal;
    // Detected User Emotion from Local Engine
    userEmotion?: string;
}

// The output is just the message content. The ChatView will handle saving it to the DB.
export type AgentOutput = Omit<Message, 'id' | 'created_at'>[];

export interface AgentExecutionResult {
    messages: AgentOutput;
    projectUpdate?: Partial<Project>;
    updatedPlan?: { messageId: string; plan: Plan };
}
