
import { AgentInput, AgentOutput, AgentExecutionResult } from './types';
import { runChatAgent } from './cocreator/chat/handler';
import { runPlanAgent } from './cocreator/plan/handler';
import { runBuildAgent } from './cocreator/build/handler';
import { runThinkerAgent } from './cocreator/thinker/handler';
import { runSuperAgent } from './cocreator/super_agent/handler';
import { runProMaxAgent } from './cocreator/pro_max/handler';
import { runPresentationAgent } from './cocreator/presentation/handler';
import { runWebAppAgent } from './cocreator/webapp/handler'; // New Import
import { runAutonomousAgent } from './autonomous/handler';
import { getUserFriendlyError } from './errorUtils';
import { summarizeOldHistory } from './historyService';
import { loadMemoriesForPrompt } from '../services/databaseService';

// Helper to normalize model names to prevent 404s
const normalizeModelName = (model: string): string => {
    let normalized = model;
    
    // Handle underscores in Gemini models (legacy setting support) e.g. gemini_2.5_flash -> gemini-2.5-flash
    if (normalized.startsWith('gemini_')) {
        normalized = normalized.replace(/_/g, '-');
    }
    
    // Handle prohibited/deprecated models by upgrading them
    if (normalized.includes('gemini-1.5-pro') || normalized === 'gemini-pro') {
        return 'gemini-3-pro-preview';
    }
    if (normalized.includes('gemini-1.5-flash')) {
        return 'gemini-2.5-flash';
    }
    
    return normalized;
};

export const runAgent = async (input: AgentInput): Promise<AgentExecutionResult> => {
    try {
        // Normalize the model before passing to agents to prevent API errors
        const normalizedModel = normalizeModelName(input.model);
        const agentInput = { ...input, model: normalizedModel };

        // Summarize conversation history if it's too long
        const optimizedHistory = await summarizeOldHistory(agentInput.history, agentInput.apiKey);

        // Fetch and inject the memory context, now project-aware and using the prompt for semantic search.
        const memoryContext = await loadMemoriesForPrompt(agentInput.supabase, agentInput.user.id, agentInput.prompt, agentInput.chat.project_id);
        
        const agentInputWithContext = { 
            ...agentInput, 
            history: optimizedHistory,
            memoryContext: memoryContext // Add memory to the input object
        };

        // Route to the dedicated autonomous agent if in that mode.
        if (agentInputWithContext.workspaceMode === 'autonomous') {
            return await runAutonomousAgent(agentInputWithContext);
        }

        // Special routing for project types in Co-Creator mode
        if (agentInput.project.project_type === 'presentation') {
            return await runPresentationAgent(agentInputWithContext);
        }
        
        // --- NEW ROUTING FOR WEB APPS ---
        if (agentInput.project.project_type === 'website') {
            return await runWebAppAgent(agentInputWithContext);
        }

        // In Co-Creator mode (Roblox/Generic), respect the user's selected chat agent.
        switch (agentInputWithContext.chat.mode) {
            case 'chat':
                return await runChatAgent(agentInputWithContext);
            case 'plan':
                return await runPlanAgent(agentInputWithContext);
            case 'build':
                return await runBuildAgent(agentInputWithContext);
            case 'thinker':
                return await runThinkerAgent(agentInputWithContext);
            case 'super_agent':
                return await runSuperAgent(agentInputWithContext);
            case 'pro_max':
                return await runProMaxAgent(agentInputWithContext);
            default:
                // Fallback to the build agent for any undefined modes that should create plans.
                return await runBuildAgent(agentInputWithContext);
        }
    } catch(error) {
        console.error(`Error running agent for mode "${input.chat.mode}" in workspace "${input.workspaceMode}":`, error);
        const errorMessage = getUserFriendlyError(error);
        const fallbackMessage: AgentOutput[0] = {
            project_id: input.chat.project_id,
            chat_id: input.chat.id,
            text: `I'm sorry, but I encountered an error while processing your request. ${errorMessage}`,
            sender: 'ai',
        };
        return { messages: [fallbackMessage] };
    }
};
