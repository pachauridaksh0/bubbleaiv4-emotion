
import { GoogleGenAI } from "@google/genai";
import { AgentInput, AgentOutput, AgentExecutionResult } from '../types';
import { canvasAgentInstruction } from './instructions';
import { getUserFriendlyError } from '../errorUtils';

// Helper for retrying Gemini calls
const generateContentStreamWithRetry = async (
    ai: GoogleGenAI, 
    params: any, 
    retries = 3,
    onRetry?: (msg: string) => void
) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await ai.models.generateContentStream(params);
        } catch (error: any) {
            // Handle 404 (Model Not Found)
            if (error.status === 404 || error.status === 400 || (error.message && (error.message.includes('404') || error.message.includes('not found') || error.message.includes('Requested entity was not found')))) {
                console.warn(`Model ${params.model} not found in Canvas Agent. Falling back to gemini-2.5-flash.`);
                if (onRetry) onRetry(`(Model ${params.model} unavailable. Falling back to Gemini 2.5 Flash...)`);
                
                if (params.model === 'gemini-2.5-flash') throw error;
                params.model = 'gemini-2.5-flash';
                continue;
            }

            const isQuotaError = error.status === 429 || 
                                 (error.message && error.message.includes('429')) ||
                                 (error.message && error.message.includes('quota'));
            
            if (isQuotaError && attempt < retries) {
                const delay = Math.pow(2, attempt) * 2000 + 1000;
                console.warn(`Quota limit hit. Retrying in ${delay}ms...`);
                if (onRetry) onRetry(`(Rate limit hit. Retrying in ${Math.round(delay/1000)}s...)`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
    throw new Error("Max retries exceeded");
};

export const runCanvasAgent = async (input: AgentInput): Promise<AgentExecutionResult> => {
    const { prompt, apiKey, project, chat, onStreamChunk } = input;
    
    // Use the model passed in input (default or user selected), falling back to Flash if missing
    const modelToUse = input.model || 'gemini-2.5-flash';

    try {
        const ai = new GoogleGenAI({ apiKey });

        // We use the selected model for code generation
        const response = await generateContentStreamWithRetry(ai, {
            model: modelToUse,
            contents: [
                { 
                    role: 'user', 
                    parts: [{ text: `Build request: "${prompt}"` }] 
                }
            ],
            config: { 
                // Thinking Config enabled for better reasoning if supported by the model
                // Note: Thinking is generally only supported on specific 2.5/3.0 models
                thinkingConfig: modelToUse.includes('thinking') || modelToUse.includes('pro') ? { thinkingBudget: 2048 } : undefined,
                // High output limit for full applications
                maxOutputTokens: 65536,
                systemInstruction: canvasAgentInstruction,
                temperature: 0.7, // Slightly higher for creativity
            }
        }, 3, (msg) => onStreamChunk?.(msg));

        let finalResponseText = "";

        for await (const chunk of response) {
            if (chunk.text) {
                finalResponseText += chunk.text;
                onStreamChunk?.(chunk.text);
            }
        }

        const aiMessage: AgentOutput[0] = {
            project_id: project.id,
            chat_id: chat.id,
            sender: 'ai',
            text: finalResponseText,
        };

        return { messages: [aiMessage] };

    } catch (error) {
        console.error("Error in runCanvasAgent:", error);
        const errorMessage = getUserFriendlyError(error);
        const fallbackMessage: AgentOutput[0] = {
            project_id: project.id,
            chat_id: chat.id,
            sender: 'ai',
            text: `I tried to generate the canvas, but hit a snag: ${errorMessage}`
        };
        return { messages: [fallbackMessage] };
    }
};
