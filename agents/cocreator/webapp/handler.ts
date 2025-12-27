
import { GoogleGenAI, Type } from "@google/genai";
import { AgentInput, AgentOutput, AgentExecutionResult } from '../../types';
import { webAppAgentInstruction, webAppArchitectInstruction } from './instructions';
import { getUserFriendlyError } from '../../errorUtils';
import { Project, Plan, Task } from '../../../types';

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

class WebStreamingResponseParser {
    private buffer: string = "";
    private mode: 'TEXT' | 'FILE' = 'TEXT';
    private currentFilePath: string | null = null;
    private currentContent: string = "";
    
    // Matches start tags like [FILE: path/to/file.lua]
    // Tolerates extra spaces
    private startTagRegex = /\[\s*FILE\s*:\s*(.*?)\s*\]/i;
    
    constructor(
        private onTextChunk: (text: string) => void,
        private onFileUpdate: (path: string, content: string, isComplete: boolean) => void
    ) {}

    // Helper to strip markdown fences from code
    private cleanContent(content: string): string {
        // 1. Remove initial markdown fence if present (e.g. ```html\n)
        let cleaned = content.replace(/^\s*```[a-zA-Z0-9]*\s*\n?/i, '');
        // 2. Remove closing markdown fence if present (e.g. \n```) at the very end
        cleaned = cleaned.replace(/\n?\s*```\s*$/, '');
        return cleaned;
    }

    processChunk(chunk: string) {
        this.buffer += chunk;
        let processed = true;
        while (processed) {
            processed = false;
            if (this.mode === 'TEXT') {
                const match = this.buffer.match(this.startTagRegex);
                if (match && match.index !== undefined) {
                    const textBefore = this.buffer.substring(0, match.index);
                    if (textBefore) this.onTextChunk(textBefore);
                    this.mode = 'FILE';
                    this.currentFilePath = match[1].trim();
                    this.currentContent = "";
                    this.buffer = this.buffer.substring(match.index + match[0].length);
                    processed = true;
                } else {
                    const lastOpenBracket = this.buffer.lastIndexOf('[');
                    if (lastOpenBracket !== -1) {
                        const safeText = this.buffer.substring(0, lastOpenBracket);
                        if (safeText) this.onTextChunk(safeText);
                        this.buffer = this.buffer.substring(lastOpenBracket);
                    } else {
                        if (this.buffer) {
                            this.onTextChunk(this.buffer);
                            this.buffer = "";
                        }
                    }
                }
            } else {
                const endTag = '[/FILE]';
                const endTagIndex = this.buffer.indexOf(endTag);
                if (endTagIndex !== -1) {
                    // FILE COMPLETE
                    const contentChunk = this.buffer.substring(0, endTagIndex);
                    this.currentContent += contentChunk;
                    
                    // Clean the final content aggressively
                    const finalContent = this.cleanContent(this.currentContent);
                    
                    if (this.currentFilePath) {
                        this.onFileUpdate(this.currentFilePath, finalContent, true);
                    }
                    
                    let remaining = this.buffer.substring(endTagIndex + endTag.length);
                    // Swallow trailing newline after [/FILE]
                    const trimMatch = remaining.match(/^\s*[\r\n]+/);
                    if (trimMatch) remaining = remaining.substring(trimMatch[0].length);
                    
                    this.buffer = remaining;
                    this.mode = 'TEXT';
                    this.currentFilePath = null;
                    processed = true;
                } else {
                    // FILE STREAMING
                    const safetyThreshold = 10; 
                    if (this.buffer.length > safetyThreshold) {
                        const safeLength = this.buffer.length - safetyThreshold;
                        const contentChunk = this.buffer.substring(0, safeLength);
                        this.currentContent += contentChunk;
                        this.buffer = this.buffer.substring(safeLength);
                        
                        if (this.currentFilePath) {
                            // Clean content even during streaming so UI doesn't show backticks
                            const cleanStreamingContent = this.cleanContent(this.currentContent);
                            this.onFileUpdate(this.currentFilePath, cleanStreamingContent, false);
                        }
                    }
                }
            }
        }
    }
    
    finish() {
        if (this.mode === 'TEXT' && this.buffer.length > 0) {
            this.onTextChunk(this.buffer);
        }
    }
}

export const runWebAppAgent = async (input: AgentInput): Promise<AgentExecutionResult> => {
    const { project, chat, prompt, apiKey, history, memoryContext, onStreamChunk, onFileUpdate, profile } = input;
    
    const ai = new GoogleGenAI({ apiKey });

    // 1. DETERMINE MODEL & CAPABILITIES
    // PRIORITIZE: Input model (from useChat calculation) > Profile preference > Default
    // This ensures that if the user selects a specific builder agent/model in settings (which is passed via input.model), it is respected.
    let model = input.model || profile?.preferred_code_model || 'gemini-2.5-flash';
    
    // Normalize deprecated models
    if (model.includes('gemini-1.5-pro')) model = 'gemini-3-pro-preview';
    if (model.includes('gemini-1.5-flash')) model = 'gemini-2.5-flash';
    
    const supportsSearch = model.includes('gemini') || model.includes('google');

    // 2. CONSTRUCT CONTEXT
    let fileContext = '';
    const fileList = Object.keys(project.files || {});
    if (fileList.length > 0) {
        fileContext += '\n\n=== CURRENT PROJECT FILES ===\n';
        for (const [path, file] of Object.entries(project.files || {})) {
            const content = file.content;
            const snippet = content.length > 3000 ? content.substring(0, 3000) + "\n...[truncated]..." : content;
            fileContext += `\n[FILE: ${path}]\n${snippet}\n[/FILE]\n`;
        }
    } else {
        fileContext = '\n\n=== CURRENT PROJECT FILES ---\n(Project is empty. Initialize necessary files.)\n';
    }

    const geminiHistory = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model' as 'user' | 'model',
        parts: [{ text: msg.text }],
    })).filter(msg => msg.parts[0].text.trim() !== '');

    let cleanResponseText = "";
    const newFilesState = { ...(project.files || {}) };

    try {
        // === STEP 0: INTENT CLASSIFICATION ===
        // Determine if this is a QUESTION (no code needed) or a CHANGE (code needed).
        let intent = "CHANGE";
        try {
            const classifierResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `USER PROMPT: "${prompt}"\n\nClassify this request into "QUESTION" (user is asking for explanation, help, or status) or "CHANGE" (user wants to modify, add, or fix code). Return JSON: { "intent": "QUESTION" | "CHANGE" }`,
                config: { responseMimeType: "application/json" }
            });
            const classifierResult = JSON.parse(classifierResponse.text || "{}");
            intent = classifierResult.intent || "CHANGE";
        } catch (e) {
            console.warn("Intent classification failed, defaulting to CHANGE");
        }

        if (intent === "QUESTION") {
            onStreamChunk?.("Thinking about your question... 🤔\n");
            
            // Just run a standard chat response with context
            const questionStream = await generateContentStreamWithRetry(ai, {
                model: model,
                contents: [...geminiHistory, { role: 'user', parts: [{ text: `User Question: "${prompt}". \n\nCONTEXT:\n${fileContext}\n\nAnswer the user's question. Do NOT generate code blocks for file updates.` }] }],
            }, 2);

            let answerText = "";
            for await (const chunk of questionStream) {
                if (chunk.text) {
                    answerText += chunk.text;
                    onStreamChunk?.(chunk.text);
                }
            }
            
            const message: AgentOutput[0] = {
                project_id: project.id,
                chat_id: chat.id,
                sender: 'ai',
                text: answerText,
                model: model // Store model used
            };
            return { messages: [message] };
        }


        // === PHASE 1: THE ARCHITECT (Thinking/Planning) ===
        // This runs FIRST to analyze the request deeply using the 7 Principles.
        
        onStreamChunk?.("<THINK>\n"); // Open the UI thinking block
        cleanResponseText += "<THINK>\n";

        let architecturalPlan = "";
        
        try {
            // We use the Architect Instruction which enforces the 7 Principles
            const architectHistory = [...geminiHistory, { role: 'user', parts: [{ text: `
MEMORY CONTEXT:
${memoryContext || 'No memory context.'}

EXISTING FILES:
${fileList.length > 0 ? fileList.join(', ') : 'None (New Project)'}

USER REQUEST:
"${prompt}"

ACTION:
Perform the Architectural Analysis now.
` }]}];

            // Use a smart model for architecture if possible (Pro > Flash)
            const architectModel = model.includes('flash') ? 'gemini-3-pro-preview' : model; 
            
            // Try to use search if available for the architect to "Explore Design Space"
            const tools = supportsSearch ? [{ googleSearch: {} }] : undefined;

            const architectStream = await generateContentStreamWithRetry(ai, {
                model: architectModel,
                contents: architectHistory,
                config: {
                    systemInstruction: webAppArchitectInstruction,
                    tools: tools,
                    temperature: 0.7, // Creativity for design
                }
            }, 2);

            for await (const chunk of architectStream) {
                if (chunk.text) {
                    architecturalPlan += chunk.text;
                    // Stream to user inside the thinking block
                    onStreamChunk?.(chunk.text);
                    cleanResponseText += chunk.text;
                }
            }

        } catch (archError) {
            console.warn("Architect phase failed, falling back to direct build.", archError);
            const fallbackMsg = "Skipping deep analysis due to connection issue. Proceeding to build...";
            onStreamChunk?.(fallbackMsg);
            cleanResponseText += fallbackMsg;
            architecturalPlan = "Analysis skipped. Follow user prompt directly.";
        }

        onStreamChunk?.("\n</THINK>\n\n"); // Close the UI thinking block
        cleanResponseText += "\n</THINK>\n\n";


        // === PHASE 2: THE BUILDER (Coding) ===
        // Now we run the actual code generation, armed with the Architect's plan.

        const builderPrompt = `
Here is the **Design Document** and Analysis provided by the Lead Architect:

${architecturalPlan}

---

INSTRUCTIONS:
1.  Implement the solution described above.
2.  Follow the **Quality Rules** (Realistic data, Error states, Accessibility).
3.  Generate ALL necessary files using the \`[FILE: path]...[/FILE]\` format.
`;

        // The builder sees the history + the new prompt containing the plan
        const builderContents = [
            ...geminiHistory, 
            { role: 'user', parts: [{ text: builderPrompt }] }
        ];

        const builderParser = new WebStreamingResponseParser(
            (text) => {
                cleanResponseText += text;
                onStreamChunk?.(text);
            },
            (path, content, isComplete) => {
                newFilesState[path] = { content };
                if (onFileUpdate) onFileUpdate(path, content, isComplete);
            }
        );

        const buildStream = await generateContentStreamWithRetry(ai, {
            model: model, // Use the user's preferred coding model passed in INPUT
            contents: builderContents,
            config: {
                systemInstruction: `${webAppAgentInstruction}\n\n${fileContext}`,
                temperature: 0.4, // Precision for code
                maxOutputTokens: 65536 // High limit for full apps
            }
        }, 3);

        for await (const chunk of buildStream) {
            if (chunk.text) {
                builderParser.processChunk(chunk.text);
            }
        }
        builderParser.finish();

        const message: AgentOutput[0] = {
            project_id: project.id,
            chat_id: chat.id,
            sender: 'ai',
            text: cleanResponseText,
            model: model // Store model used
        };

        return { messages: [message], projectUpdate: { files: newFilesState } };

    } catch (error) {
        console.error("Error in runWebAppAgent:", error);
        const errorMessage = getUserFriendlyError(error);
        const fallbackMessage: AgentOutput[0] = {
            project_id: project.id,
            chat_id: chat.id,
            sender: 'ai',
            text: `I encountered an error building the app: ${errorMessage}`
        };
        return { messages: [fallbackMessage] };
    }
};
