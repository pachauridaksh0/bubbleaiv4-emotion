
import { GoogleGenAI, Type } from "@google/genai";
import { AgentInput, AgentOutput, AgentExecutionResult } from '../../types';
import { buildAgentInstruction } from './instructions';
import { robloxAgentInstruction } from '../roblox/instructions';
import { webAppAgentInstruction } from '../webapp/instructions';
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

// Helper to apply a search/replace patch
const applyPatch = (originalContent: string, searchBlock: string, replaceBlock: string): string | null => {
    if (!originalContent.includes(searchBlock)) {
        // Try relaxed matching (ignoring leading/trailing whitespace on lines)
        const normalize = (str: string) => str.split('\n').map(l => l.trim()).filter(l => l).join('\n');
        if (normalize(originalContent).includes(normalize(searchBlock))) {
             console.warn("Patch match failed (strict). Normalized match found but not implemented safely.");
             return null;
        }
        return null;
    }
    return originalContent.replace(searchBlock, replaceBlock);
};

class StreamingResponseParser {
    private buffer: string = "";
    private mode: 'TEXT' | 'FILE' | 'PATCH' = 'TEXT';
    private currentFilePath: string | null = null;
    private currentContent: string = "";
    
    // Regex patterns
    // Matches start tags like [FILE: path/to/file.lua] or [PATCH: path/to/file.lua]
    // Tolerates spaces around colons and inside brackets
    private startTagRegex = /\[\s*(FILE|PATCH)\s*:\s*(.*?)\s*\]/i;
    
    constructor(
        private onTextChunk: (text: string) => void,
        private onFileUpdate: (path: string, content: string, isComplete: boolean) => void,
        private projectFiles: Record<string, { content: string }>
    ) {}

    processChunk(chunk: string) {
        this.buffer += chunk;
        
        let processed = true;
        while (processed) {
            processed = false;

            if (this.mode === 'TEXT') {
                const match = this.buffer.match(this.startTagRegex);
                
                if (match && match.index !== undefined) {
                    // 1. Flush text BEFORE the tag
                    const textBefore = this.buffer.substring(0, match.index);
                    if (textBefore) this.onTextChunk(textBefore);

                    // 2. Switch mode
                    this.mode = match[1].toUpperCase() as 'FILE' | 'PATCH';
                    this.currentFilePath = match[2].trim();
                    this.currentContent = "";

                    // 3. Advance buffer past the tag
                    this.buffer = this.buffer.substring(match.index + match[0].length);
                    processed = true; // Continue processing immediately
                } else {
                    // No complete tag found.
                    // BUT, we might have a partial tag at the end (e.g. "[FI")
                    // We must NOT flush the partial tag.
                    const lastOpenBracket = this.buffer.lastIndexOf('[');
                    
                    if (lastOpenBracket !== -1) {
                        // Flush everything up to the bracket
                        const safeText = this.buffer.substring(0, lastOpenBracket);
                        if (safeText) this.onTextChunk(safeText);
                        // Keep the bracket and everything after it in the buffer
                        this.buffer = this.buffer.substring(lastOpenBracket);
                    } else {
                        // No brackets at all, flush everything
                        if (this.buffer) {
                            this.onTextChunk(this.buffer);
                            this.buffer = "";
                        }
                    }
                }
            } else {
                // FILE or PATCH mode
                const endTag = this.mode === 'FILE' ? '[/FILE]' : '[/PATCH]';
                const endTagIndex = this.buffer.indexOf(endTag);

                if (endTagIndex !== -1) {
                    // Found end tag!
                    const contentChunk = this.buffer.substring(0, endTagIndex);
                    
                    this.currentContent += contentChunk;
                    let finalContent = this.currentContent;
                    
                    // Strip standard markdown code blocks if present
                    finalContent = finalContent.replace(/^```\w*\s*|\s*```$/g, '');

                    if (this.mode === 'FILE' && this.currentFilePath) {
                        this.onFileUpdate(this.currentFilePath, finalContent, true);
                    } else if (this.mode === 'PATCH' && this.currentFilePath) {
                        this.processPatch(finalContent);
                    }

                    // Reset and Swallow trailing newline to prevent UI gaps
                    let remaining = this.buffer.substring(endTagIndex + endTag.length);
                    
                    // Optimization: If the block is followed immediately by whitespace/newlines, swallow them
                    // so the chat text flows better.
                    const trimMatch = remaining.match(/^\s*[\r\n]+/);
                    if (trimMatch) {
                        remaining = remaining.substring(trimMatch[0].length);
                    }

                    this.buffer = remaining;
                    this.mode = 'TEXT';
                    this.currentFilePath = null;
                    processed = true;
                } else {
                    // No end tag yet.
                    // Stream the content, but keep a safety buffer to avoid splitting the end tag
                    // End tag is max 8 chars "[/PATCH]"
                    const safetyThreshold = 10; 
                    
                    if (this.buffer.length > safetyThreshold) {
                        const safeLength = this.buffer.length - safetyThreshold;
                        const contentChunk = this.buffer.substring(0, safeLength);
                        
                        this.currentContent += contentChunk;
                        this.buffer = this.buffer.substring(safeLength);
                        
                        // Emit partial update for FILES (PATCHES wait for completion)
                        if (this.mode === 'FILE' && this.currentFilePath) {
                            // For streaming, we don't strip markdown fences yet as they might be incomplete.
                            // Ideally instructions prevent fences, but we rely on final cleanup for correctness.
                            this.onFileUpdate(this.currentFilePath, this.currentContent, false);
                        }
                    }
                }
            }
        }
    }

    private processPatch(patchBlock: string) {
        // Format: <<<< search ==== replace >>>>
        const searchStart = patchBlock.indexOf('<<<<');
        const separator = patchBlock.indexOf('====');
        const replaceEnd = patchBlock.lastIndexOf('>>>>');

        if (searchStart !== -1 && separator !== -1 && replaceEnd !== -1 && this.currentFilePath) {
            const searchBlock = patchBlock.substring(searchStart + 4, separator).trim();
            const replaceBlock = patchBlock.substring(separator + 4, replaceEnd); // Keep whitespace for replacement
            
            const currentFile = this.projectFiles[this.currentFilePath];
            if (currentFile) {
                const patchedContent = applyPatch(currentFile.content, searchBlock, replaceBlock);
                if (patchedContent) {
                    this.onFileUpdate(this.currentFilePath, patchedContent, true);
                } else {
                    this.onTextChunk(`\n\n[SYSTEM ERROR]: Failed to apply patch to ${this.currentFilePath}. Search block not found or context mismatch.`);
                }
            } else {
                this.onTextChunk(`\n\n[SYSTEM ERROR]: File ${this.currentFilePath} not found for patching.`);
            }
        }
    }
    
    finish() {
        // Flush any remaining buffer as text if we are in TEXT mode
        if (this.mode === 'TEXT' && this.buffer.length > 0) {
            this.onTextChunk(this.buffer);
        }
    }
}

export const runBuildAgent = async (input: AgentInput): Promise<AgentExecutionResult> => {
    const { project, chat, prompt, apiKey, history, memoryContext, onStreamChunk, onFileUpdate } = input;
    
    let model = input.model;
    if (!model.startsWith('gemini') && !model.startsWith('veo') && !model.includes('google')) {
        model = 'gemini-2.5-flash';
    }

    const ai = new GoogleGenAI({ apiKey });

    let effectivePrompt = prompt;
    let planToUpdate: { messageId: string, plan: Plan } | null = null;
    let taskToExecute: Task | null = null;

    const planMessage = [...history].reverse().find(m => m.sender === 'ai' && m.plan);
    if (planMessage && planMessage.plan) {
        const firstPendingTask = planMessage.plan.tasks.find(t => t.status === 'pending');
        if (firstPendingTask) {
            onStreamChunk?.(`Starting task: "${firstPendingTask.text}"... 🛠️`);
            effectivePrompt = `Based on the project plan, execute ONLY this task: "${firstPendingTask.text}". Provide all necessary code and file paths.`;
            planToUpdate = { messageId: planMessage.id, plan: JSON.parse(JSON.stringify(planMessage.plan)) };
            taskToExecute = firstPendingTask;
        } else {
            onStreamChunk?.("All tasks in the plan are complete! What should we build next?");
        }
    } else {
        onStreamChunk?.("Alright, let's get building... 🛠️");
    }
    
    // Construct strict file context to prevent duplicates
    let fileContext = '';
    const fileList = Object.keys(project.files || {});
    
    if (fileList.length > 0) {
        fileContext += '\n\n=== EXISTING PROJECT FILES (DO NOT CREATE DUPLICATES) ===\n';
        fileContext += 'You MUST update these files if the task is related to them. Do not create copies like "Script (1).lua".\n';
        
        // Provide content for context, but truncate large files
        for (const [path, file] of Object.entries(project.files || {})) {
            const content = file.content;
            const snippet = content.length > 2000 ? content.substring(0, 2000) + "\n...[truncated]..." : content;
            fileContext += `\n--- FILE: ${path} ---\n${snippet}\n`;
        }
    } else {
        fileContext = '\n\n=== CURRENT PROJECT FILES ---\nThis project is currently empty. You are free to create the initial file structure.\n';
    }

    const geminiHistory = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model' as 'user' | 'model',
        parts: [{ text: msg.plan ? `[SYSTEM PLAN]: ${JSON.stringify(msg.plan)}` : msg.text }],
    })).filter(msg => msg.parts[0].text.trim() !== '');

    const contents = [...geminiHistory, { role: 'user', parts: [{ text: effectivePrompt }] }];
    
    // Dynamic System Instruction Selection
    let specificInstruction = buildAgentInstruction;
    if (project.project_type === 'roblox_game') {
        specificInstruction = robloxAgentInstruction;
    } else if (project.project_type === 'website') {
        specificInstruction = webAppAgentInstruction;
    }

    const systemInstruction = `${specificInstruction}\n\n=== MEMORY CONTEXT ===\n${memoryContext || 'No memory context available.'}${fileContext}`;

    let updatedPlanForReturn: { messageId: string, plan: Plan } | undefined = undefined;
    
    // Track updated files for plan summary
    const filesUpdatedSet = new Set<string>();
    const newFilesState = { ...(project.files || {}) };
    
    // Capture the clean text shown to the user to save as the final message
    let cleanResponseText = "";

    // Initialize Parser
    const parser = new StreamingResponseParser(
        (text) => {
            cleanResponseText += text;
            onStreamChunk?.(text);
        },
        (path, content, isComplete) => {
            // Update local state tracker
            newFilesState[path] = { content };
            filesUpdatedSet.add(path);
            // Trigger callback for UI update
            if (onFileUpdate) onFileUpdate(path, content, isComplete);
        },
        newFilesState
    );

    try {
        const responseStream = await generateContentStreamWithRetry(ai, {
            model, contents, config: { 
                systemInstruction, 
                temperature: 0.5, 
                topP: 0.9 
            }
        }, 3, (msg) => onStreamChunk?.(msg));

        for await (const chunk of responseStream) {
            if (chunk.text) {
                // Pipe through parser. The parser calls the callbacks.
                parser.processChunk(chunk.text);
            }
        }
        parser.finish();

        if (planToUpdate && taskToExecute) {
            const taskIndex = planToUpdate.plan.tasks.findIndex(t => t.text === taskToExecute!.text);
            if (taskIndex > -1) {
                planToUpdate.plan.tasks[taskIndex].status = 'complete';
                planToUpdate.plan.tasks[taskIndex].code = filesUpdatedSet.size > 0 
                    ? `Updated files: ${Array.from(filesUpdatedSet).join(', ')}` 
                    : "No files modified.";
                planToUpdate.plan.tasks[taskIndex].explanation = "Task completed via streaming build.";
                updatedPlanForReturn = planToUpdate;
            }
        }

        // Return the CLEAN text. We do NOT return the raw text containing [FILE] tags
        // because the file state is already persisted in the project via onFileUpdate.
        // This prevents the tags from reappearing in the chat history view.
        const message: AgentOutput[0] = {
            project_id: project.id,
            chat_id: chat.id,
            sender: 'ai',
            text: cleanResponseText, 
        };

        return { messages: [message], projectUpdate: { files: newFilesState }, updatedPlan: updatedPlanForReturn };

    } catch (error) {
        console.error("Error in runBuildAgent:", error);
        const errorMessage = getUserFriendlyError(error);
        
        if (planToUpdate && taskToExecute) {
             const taskIndex = planToUpdate.plan.tasks.findIndex(t => t.text === taskToExecute!.text);
             if (taskIndex > -1) {
                planToUpdate.plan.tasks[taskIndex].status = 'complete'; 
                planToUpdate.plan.tasks[taskIndex].explanation = `Error: ${errorMessage}`;
             }
             updatedPlanForReturn = planToUpdate;
        }

        const fallbackMessage: AgentOutput[0] = {
            project_id: project.id,
            chat_id: chat.id,
            sender: 'ai',
            text: `I'm sorry, I encountered an error while working on that task. ${errorMessage}`
        };
        return { messages: [fallbackMessage], projectUpdate: undefined, updatedPlan: updatedPlanForReturn };
    }
};
