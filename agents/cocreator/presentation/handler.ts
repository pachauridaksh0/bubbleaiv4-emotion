
import { GoogleGenAI } from "@google/genai";
import { AgentInput, AgentOutput, AgentExecutionResult } from '../../types';
import { presentationAgentInstruction } from './instructions';
import { getUserFriendlyError } from '../../errorUtils';

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
                console.warn(`Model ${params.model} not found in Presentation Agent. Falling back to gemini-2.5-flash.`);
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

export const runPresentationAgent = async (input: AgentInput): Promise<AgentExecutionResult> => {
    const { prompt, apiKey, model, project, chat, onStreamChunk, history, memoryContext } = input;
    
    // Ensure we use a valid model or fallback to flash
    const modelToUse = model || 'gemini-2.5-flash';

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Filter history to keep context clean
        const geminiHistory = history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model' as 'user' | 'model',
            parts: [{ text: msg.text }],
        })).filter(msg => msg.parts[0].text.trim() !== '');

        const contents = [...geminiHistory, { role: 'user', parts: [{ text: prompt }] }];
        const systemInstruction = `${presentationAgentInstruction}\n\nMEMORY CONTEXT:\n${memoryContext || 'No memory context available.'}`;

        onStreamChunk?.("Drafting presentation slides... 📊");

        const responseStream = await generateContentStreamWithRetry(ai, {
            model: modelToUse,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
                maxOutputTokens: 4096,
            },
        }, 3, (msg) => onStreamChunk?.(msg));

        let fullText = '';
        for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                onStreamChunk?.(chunkText);
            }
        }

        const aiMessage: AgentOutput[0] = {
            project_id: project.id,
            chat_id: chat.id,
            sender: 'ai',
            text: "Here is the presentation draft. You can view the rendered slides in the workspace panel.",
            code: fullText, // Store slides in code field for the workspace parser
            language: 'markdown'
        };

        return { messages: [aiMessage] };
    } catch (error) {
        console.error("Error in runPresentationAgent:", error);
        const errorMessage = getUserFriendlyError(error);
        const fallbackMessage: AgentOutput[0] = {
            project_id: project.id,
            chat_id: chat.id,
            sender: 'ai',
            text: errorMessage
        };
        return { messages: [fallbackMessage] };
    }
};
