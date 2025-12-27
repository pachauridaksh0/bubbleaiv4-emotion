
import { GoogleGenAI } from "@google/genai";
import { AgentInput, AgentExecutionResult } from '../types';
import { getUserFriendlyError } from '../errorUtils';
import { generateImage } from '../../services/geminiService';
import { incrementThinkingCount } from '../../services/databaseService';
import { researchService } from "../../services/researchService";
import { BubbleSemanticRouter, RouterAction } from "../../services/semanticRouter";
import { Memory5Layer } from "../../services/memoryService";
import { autonomousInstruction } from './instructions';
import { runCanvasAgent } from "../canvas/handler";
import { generateFreeCompletion } from "../../services/freeLlmService";
import { 
    shouldUseExternalSearch, 
    runWebSearch,
    WebSearchResult 
} from "../../services/externalSearchService";
import { EmotionData } from "../../types";

const formatTimestamp = () => {
    return new Date().toLocaleString(undefined, { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' 
    });
};

const isGoogleModel = (model: string) => {
    if (!model) return true; 
    const lower = model.toLowerCase();
    return lower.startsWith('gemini') || lower.startsWith('veo') || lower.includes('google');
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

const generateContentStreamWithRetry = async (
    ai: GoogleGenAI, 
    params: any, 
    retries = 3,
    onRetry?: (msg: string) => void
) => {
    if (!params.model) {
        console.warn("Model undefined in generateContent call, defaulting to gemini-2.5-flash");
        params.model = 'gemini-2.5-flash';
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await ai.models.generateContentStream(params);
        } catch (error: any) {
            if (error.status === 404 || error.status === 400 || (error.message && (error.message.includes('404') || error.message.includes('not found') || error.message.includes('Requested entity was not found')))) {
                console.warn(`Model ${params.model} not found or invalid. Falling back to gemini-2.5-flash.`);
                if (onRetry) onRetry(`(Model ${params.model} unavailable. Falling back to Gemini 2.5 Flash...)`);
                
                if (params.model === 'gemini-2.5-flash') {
                     throw error;
                }

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

const generateOpenRouterStream = async (
    apiKey: string,
    model: string,
    messages: any[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "Bubble AI"
        },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
            temperature: 0.7,
        }),
        signal
    });

    if (!response.ok) {
        const errText = await response.text();
        // Parse error if possible
        try {
            const errJson = JSON.parse(errText);
            throw new Error(`OpenRouter Error ${response.status}: ${errJson.error?.message || errText}`);
        } catch {
            throw new Error(`OpenRouter Error ${response.status}: ${errText}`);
        }
    }

    if (!response.body) throw new Error("No response body from OpenRouter");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") return;
                try {
                    const json = JSON.parse(dataStr);
                    const content = json.choices?.[0]?.delta?.content;
                    if (content) onChunk(content);
                } catch (e) {
                    console.warn("Error parsing OpenRouter stream chunk", e);
                }
            }
        }
    }
};

export const runAutonomousAgent = async (input: AgentInput): Promise<AgentExecutionResult> => {
    let { prompt, files, apiKey, project, chat, history, supabase, user, profile, onStreamChunk, model, thinkingMode, signal, userEmotion } = input;
    
    // Fetch memory FIRST
    let memoryContextString = "";
    try {
        const memory = new Memory5Layer(supabase, user.id);
        const context = await memory.getContext([
            'inner_personal', 'outer_personal', 'personal', 
            'interests', 'preferences', 'custom', 
            'codebase', 'aesthetic', 'project'
        ]);
        memoryContextString = JSON.stringify(context);
    } catch(e) {
        console.warn("Memory fetch failed:", e);
    }

    // INSTANT MODE
    if (thinkingMode === 'instant') {
        try {
            const historyWithoutLast = history.length > 0 && history[history.length - 1].sender === 'user' ? history.slice(0, -1) : history;
            const messages = historyWithoutLast.map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.text
            }));
            
            let fileContext = "";
            let imageNote = "";

            if (files && files.length > 0) {
                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        imageNote += `\n[User attached image: "${file.name}"]`;
                    } else if (file.type.startsWith('text/') || file.name.match(/\.(js|ts|tsx|jsx|json|md|html|css|py|lua)$/)) {
                        try {
                            const content = await readTextFile(file);
                            fileContext += `\n\n--- FILE: ${file.name} ---\n${content}\n--- END FILE ---\n`;
                        } catch (e) {
                            fileContext += `\n[Error reading file: ${file.name}]`;
                        }
                    }
                }
            }

            const finalPrompt = `${prompt}${imageNote}${fileContext}`;
            messages.push({ role: 'user', content: finalPrompt });

            const { text: finalResponseText, modelUsed } = await generateFreeCompletion(messages, onStreamChunk, signal, memoryContextString);
            
            return { 
                messages: [{ 
                    project_id: project.id, 
                    chat_id: chat.id, 
                    sender: 'ai', 
                    text: finalResponseText,
                    model: modelUsed
                }] 
            };
        } catch (e) {
            console.error("Instant mode failed", e);
            throw new Error("Instant mode service unavailable.");
        }
    }

    if (!model || model.trim() === '') {
        model = 'gemini-2.5-flash';
    }

    let isNative = isGoogleModel(model);
    const openRouterKey = profile?.openrouter_api_key;

    if (!isNative && !openRouterKey) {
         onStreamChunk?.("\n*(OpenRouter key missing, falling back to Gemini...)*\n");
         model = 'gemini-2.5-flash';
         isNative = true;
    }

    let thinkingBudget = 0;
    
    if (thinkingMode === 'deep') {
        const preferredDeep = profile?.preferred_deep_model;
        model = preferredDeep || 'gemini-3-pro-preview';
        thinkingBudget = 8192; 
        isNative = isGoogleModel(model); 
    } else if (thinkingMode === 'think') {
        model = 'gemini-2.5-flash';
        thinkingBudget = 2048; 
        isNative = true;
    }

    if (thinkingBudget > 0 && isNative && !model.includes('gemini-2.5') && !model.includes('gemini-3')) {
        onStreamChunk?.(`\n*(Switched to Gemini 2.5 Flash for Thinking mode compatibility)*\n`);
        model = 'gemini-2.5-flash';
    }

    let finalResponseText = '';

    try {
        const modelSupportsSearch = isNative || model.includes('perplexity');
        const ai = new GoogleGenAI({ apiKey }); 
        const router = new BubbleSemanticRouter(supabase);

        const fileCount = files ? files.length : 0;
        let routing = await router.route(prompt, user.id, apiKey, fileCount);
        
        let externalSearchContext = "";
        
        let metadataPayload: { groundingMetadata?: any[] } = {};
        
        if (shouldUseExternalSearch(prompt, modelSupportsSearch, false)) {
            const searchTag = `<SEARCH>${prompt}</SEARCH>`;
            onStreamChunk?.(searchTag);
            finalResponseText += searchTag; 
            
            const searchResults = await runWebSearch(prompt, 15);
            
            if (profile?.role === 'admin') {
                const debugOutput = `\n\n\`\`\`json\n[ADMIN DEBUG: SEARCH]\nQuery: "${prompt}"\nResults: ${searchResults.length}\nData: ${JSON.stringify(searchResults, null, 2)}\n\`\`\`\n\n`;
                onStreamChunk?.(debugOutput);
                finalResponseText += debugOutput;
            }
            
            if (searchResults.length > 0) {
                metadataPayload.groundingMetadata = searchResults.map(p => ({ 
                    web: { uri: p.url, title: p.title } 
                }));

                externalSearchContext = `
=== EXTERNAL WEB SEARCH RESULTS ===
Query: "${prompt}"
${searchResults.map((p, i) => `
--- RESULT ${i+1} ---
Title: ${p.title}
URL: ${p.url}
Content: ${p.content || p.snippet || '(No content available)'}
`).join('\n')}
===================================
`;
            } else {
                externalSearchContext = `[System: Search executed for "${prompt}" but returned no results. Rely on internal knowledge.]`;
            }
        }

        const memoryObject = JSON.parse(memoryContextString);
        const dateTimeContext = `[CURRENT DATE & TIME]\n${formatTimestamp()}\n`;
        const rawModelName = model.split('/').pop() || model;
        const friendlyModelName = rawModelName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
        let modelIdentityBlock = `You are currently running on the model: **${friendlyModelName}**.\nIf the user asks "Which AI model are you?", reply that you are Bubble, running on ${friendlyModelName}.`;
        
        if (thinkingBudget > 0) {
            modelIdentityBlock += `\n\n[THINKING ENABLED]\nBudget: ${thinkingBudget} tokens. MANDATORY: Wrap thought process in <THINK> tags.`;
        }

        // --- EMOTION ENGINE INJECTION ---
        let emotionBlock = "";
        let isSeriousMode = false;

        let emotionData: EmotionData = { dominant: 'Neutral', scores: { Neutral: 100 } };
        if (userEmotion) {
            if (typeof userEmotion === 'string') {
                emotionData = { dominant: userEmotion, scores: { [userEmotion]: 100 } };
            } else {
                emotionData = userEmotion as unknown as EmotionData;
            }
        }

        if (emotionData.scores) {
            const seriousScore = emotionData.scores['Serious'] || 0;
            const angerScore = emotionData.scores['Anger'] || 0;
            
            if (seriousScore > 50 || angerScore > 50) {
                isSeriousMode = true;
            }
        }

        if (isSeriousMode) {
            emotionBlock = `
=== SOCIAL INTELLIGENCE: SERIOUS MODE ===
The user is detected as SERIOUS or FRUSTRATED.
**ACTION:** DROP the cheerful persona. Be direct, professional, and efficient. No fluff. No emojis.
`;
        } else {
             // Joyful/Neutral Mode or Loading Fallback
             emotionBlock = `
=== SOCIAL INTELLIGENCE: FRIENDLY MODE ===
The user is detected as ${emotionData.dominant}.
**ACTION:** Be your naturally joyful, encouraging self. Use casual language and show enthusiasm for their ideas!
`;
        }

        let baseSystemInstruction = autonomousInstruction.replace('[MODEL_IDENTITY_BLOCK]', modelIdentityBlock);

        // --- NEW: INJECT USER PREFERENCES FROM PROFILE ---
        let toneInstruction = "";
        if (profile?.ai_tone === 'serious') {
            toneInstruction = "Tone Rule: Adopt a strictly professional, objective, and serious tone. Avoid humor, emoticons, or casual slang. Focus purely on facts and logic.";
        } else if (profile?.ai_tone === 'ambient') {
            toneInstruction = "Tone Rule: Adopt an ambient, creative, and immersive tone. Use vivid imagery and a relaxed pace. Feel free to be poetic.";
        } else {
            toneInstruction = "Tone Rule: Personalize your tone to match the user's energy and preferences found in memory. Be warm and authentic.";
        }

        let lengthInstruction = "";
        if (profile?.ai_length === 'compact') {
            lengthInstruction = "Length Rule: Keep responses extremely concise and to the point. Avoid fluff or conversational filler. Give the answer immediately.";
        } else if (profile?.ai_length === 'long') {
            lengthInstruction = "Length Rule: Provide comprehensive, detailed, and extensive responses. Expand on topics fully and offer deep context.";
        } else {
            lengthInstruction = "Length Rule: Provide standard length responses, balancing detail with brevity. Avoid being overly verbose unless necessary.";
        }

        let customInstructionBlock = "";
        if (profile?.custom_instructions && profile.custom_instructions.trim() !== "") {
            customInstructionBlock = `\n\n=== USER CUSTOM INSTRUCTIONS ===\nThese instructions override default behaviors:\n${profile.custom_instructions.trim()}\n`;
        }

        baseSystemInstruction += `\n\n=== USER STYLE PREFERENCES ===\n${toneInstruction}\n${lengthInstruction}${customInstructionBlock}\n${emotionBlock}`;
        
        // ----------------------------------------------------

        let fallbackSearchContext = ''; 
        let currentAction: RouterAction = routing.action;
        let currentPrompt: string = prompt;
        let loopCount = 0;
        const MAX_LOOPS = 6; 

        while (loopCount < MAX_LOOPS) {
            if (signal?.aborted) break;
            loopCount++;

            const enrichedMemoryContext = { ...memoryObject, external_web_search: externalSearchContext };

            switch (currentAction) {
                case 'SIMPLE':
                default: {
                    const systemPrompt = `${baseSystemInstruction}\n\n[MEMORY]\n${JSON.stringify(enrichedMemoryContext)}\n\n${dateTimeContext}`;
                    const historyWithoutLast = (history.length > 0 && history[history.length - 1].sender === 'user') 
                        ? history.slice(0, -1) 
                        : history;

                    let generatedThisLoop: string = "";
                    let primaryGenerationFailed = false;

                    try {
                        if (isNative) {
                            const historyMessages = historyWithoutLast.map(msg => ({
                                role: msg.sender === 'user' ? 'user' : 'model' as 'user' | 'model',
                                parts: [{ text: msg.text }] 
                            })).filter(msg => msg.parts[0].text.trim() !== '');

                            const userParts: any[] = [{ text: currentPrompt }];

                            if (files && files.length > 0) {
                                for (const file of files) {
                                    if (file.type.startsWith('image/')) {
                                        try {
                                            const base64Data = await fileToBase64(file);
                                            userParts.push({ inlineData: { mimeType: file.type, data: base64Data } });
                                        } catch (e) {
                                            console.error("Failed to process image attachment:", e);
                                            userParts.push({ text: `[Error attaching image: ${file.name}]` });
                                        }
                                    } else if (file.type.startsWith('text/') || file.name.match(/\.(js|ts|jsx|tsx|html|css|json|md|py|lua)$/)) {
                                        try {
                                            const content = await readTextFile(file);
                                            userParts.push({ text: `\n\n--- FILE: ${file.name} ---\n${content}\n--- END FILE ---\n` });
                                        } catch (e) {
                                            userParts.push({ text: `[Error reading text file: ${file.name}]` });
                                        }
                                    }
                                }
                            }

                            historyMessages.push({ role: 'user', parts: userParts } as any);

                            const contents = historyMessages.map(m => ({ role: m.role, parts: m.parts }));
                            const config: any = { systemInstruction: systemPrompt };
                            config.tools = [{ googleSearch: {} }];
                            
                            if (thinkingBudget > 0) {
                                config.thinkingConfig = { thinkingBudget: thinkingBudget };
                                config.maxOutputTokens = 65536; 
                            }

                            const generator = await generateContentStreamWithRetry(ai, {
                                model,
                                contents,
                                config
                            }, 3, (msg) => onStreamChunk?.(msg));

                            for await (const chunk of generator) {
                                if (signal?.aborted) break;
                                if (chunk.text) {
                                    generatedThisLoop += chunk.text;
                                    finalResponseText += chunk.text;
                                    onStreamChunk?.(chunk.text);
                                    
                                    const candidate = (chunk as any).candidates?.[0];
                                    if (candidate?.groundingMetadata?.groundingChunks) {
                                        if (!metadataPayload.groundingMetadata) metadataPayload.groundingMetadata = [];
                                        const chunks = candidate.groundingMetadata.groundingChunks;
                                        if (metadataPayload.groundingMetadata && Array.isArray(metadataPayload.groundingMetadata) && Array.isArray(chunks)) {
                                            metadataPayload.groundingMetadata.push(...chunks);
                                        }
                                    }

                                    if (
                                        generatedThisLoop.includes('</CANVAS_TRIGGER>') ||
                                        generatedThisLoop.includes('</CANVASTRIGGER>') ||
                                        generatedThisLoop.includes('</CANVAS>')
                                    ) {
                                        break; 
                                    }
                                }
                            }

                        } else {
                            if (!openRouterKey) throw new Error("OpenRouter API Key not found.");

                            const openAiMessages: any[] = [
                                { role: 'system', content: systemPrompt },
                                ...historyWithoutLast.map(m => ({
                                    role: m.sender === 'user' ? 'user' : 'assistant',
                                    content: m.text
                                }))
                            ];

                            const userContent: any[] = [{ type: 'text', text: currentPrompt }];
                            let hasImage = false;

                            if (files && files.length > 0) {
                                for (const file of files) {
                                    if (file.type.startsWith('image/')) {
                                        hasImage = true;
                                        try {
                                            const base64Data = await fileToBase64(file);
                                            userContent.push({ 
                                                type: 'image_url', 
                                                image_url: { url: `data:${file.type};base64,${base64Data}` } 
                                            });
                                        } catch (e) {
                                            console.error("Failed to process image attachment for OpenRouter:", e);
                                            userContent.push({ type: 'text', text: `[Error attaching image: ${file.name}]` });
                                        }
                                    } else if (file.type.startsWith('text/') || file.name.match(/\.(js|ts|jsx|tsx|html|css|json|md|py|lua)$/)) {
                                        try {
                                            const content = await readTextFile(file);
                                            userContent.push({ type: 'text', text: `\n\n--- FILE: ${file.name} ---\n${content}\n--- END FILE ---\n` });
                                        } catch (e) {
                                            userContent.push({ type: 'text', text: `[Error reading text file: ${file.name}]` });
                                        }
                                    }
                                }
                            }

                            if (hasImage && !model.toLowerCase().includes('vision') && !model.toLowerCase().includes('gemini') && !model.toLowerCase().includes('claude') && !model.toLowerCase().includes('gpt-4')) {
                                throw new Error("The selected model does not support image inputs. Please switch to a vision-capable model like Gemini Pro or Claude Sonnet.");
                            }

                            openAiMessages.push({ role: 'user', content: userContent });

                            await generateOpenRouterStream(openRouterKey, model, openAiMessages, (chunk) => {
                                if (signal?.aborted) return;
                                generatedThisLoop += chunk;
                                finalResponseText += chunk;
                                onStreamChunk?.(chunk);
                            }, signal);
                        }
                    } catch (primaryError) {
                        console.warn(`Primary generation failed (${isNative ? 'Google' : 'OpenRouter'}). Attempting fallback...`, primaryError);
                        primaryGenerationFailed = true;
                    }

                    if (primaryGenerationFailed) {
                        throw primaryGenerationFailed; 
                    }
                    
                    const searchMatches: RegExpMatchArray[] = Array.from(generatedThisLoop.matchAll(/<SEARCH>([\s\S]*?)<\/SEARCH>/g));
                    if (searchMatches.length > 0) {
                        const queries: string[] = searchMatches.map((m: RegExpMatchArray) => m[1] ? m[1].trim() : "").filter((q): q is string => !!q && q.length > 0);
                        if (queries.length > 0) {
                             const query = queries[0];
                             if (shouldUseExternalSearch(query, modelSupportsSearch, true)) {
                                 const searchResults = await runWebSearch(query, 15);
                                 if (searchResults.length > 0) {
                                     let aggregatedContext = "";
                                     searchResults.forEach(res => aggregatedContext += `${res.title}: ${res.snippet}\n`);
                                     fallbackSearchContext = aggregatedContext;
                                     const synthesisPrompt = `USER ORIGINALLY ASKED: ${prompt}\n\nI have performed the following searches based on my previous thought process:\n- ${query}\n\nSEARCH CONTEXT:\n${fallbackSearchContext}\n\nINSTRUCTIONS: Synthesize a comprehensive answer to the user's original query using this search data. Cite sources using [1], [2] format. Do NOT repeat the <SEARCH> tags.`;
                                     currentPrompt = synthesisPrompt;
                                     currentAction = 'SIMPLE';
                                     continue;
                                 } else {
                                     fallbackSearchContext = `[System: Search executed for "${query}" but returned no results. Continue with internal knowledge.]`;
                                     const synthesisPrompt = `USER ORIGINALLY ASKED: ${prompt}\n\nI attempted to search for: "${query}" but found no results.\n\nINSTRUCTIONS: Continue answering the user's request using your internal knowledge. Do NOT repeat the <SEARCH> tags.`;
                                     currentPrompt = synthesisPrompt;
                                     currentAction = 'SIMPLE';
                                     continue;
                                 }
                             }
                        }
                    }

                    const deepMatch = generatedThisLoop.match(/<DEEP>([\s\S]*?)<\/DEEP>/);
                    const imageMatch = generatedThisLoop.match(/<IMAGE>([\s\S]*?)<\/IMAGE>/);
                    const projectMatch = generatedThisLoop.match(/<PROJECT>([\s\S]*?)<\/PROJECT>/);
                    
                    const canvasMatch = generatedThisLoop.match(/<CANVAS_TRIGGER>([\s\S]*?)<\/CANVAS_TRIGGER>/) || 
                                        generatedThisLoop.match(/<CANVAS_TRIGGER>([\s\S]*?)<\/CANVASTRIGGER>/) || 
                                        generatedThisLoop.match(/<CANVAS>([\s\S]*?)<\/CANVAS>/) ||
                                        generatedThisLoop.match(/<CANVASTRIGGER>([\s\S]*?)<\/CANVASTRIGGER>/);
                    
                    const studyMatch = generatedThisLoop.match(/<STUDY>([\s\S]*?)<\/STUDY>/);

                    if (deepMatch && deepMatch[1]) { 
                        currentAction = 'DEEP_SEARCH'; 
                        currentPrompt = deepMatch[1]; 
                        continue; 
                    }
                    
                    if (searchMatches.length === 1 && !fallbackSearchContext) { 
                        break; 
                    }
                    
                    if (imageMatch && imageMatch[1]) { 
                        currentAction = 'IMAGE'; 
                        const p = imageMatch[1];
                        currentPrompt = p; 
                        routing.parameters = { prompt: p }; 
                        continue; 
                    }
                    if (projectMatch && projectMatch[1]) { 
                        currentAction = 'PROJECT'; 
                        currentPrompt = projectMatch[1]; 
                        continue; 
                    }

                    if (canvasMatch && canvasMatch[1]) { 
                        finalResponseText = ""; 
                        currentAction = 'CANVAS'; 
                        currentPrompt = canvasMatch[1].trim(); 
                        
                        const canvasResult = await runCanvasAgent({ ...input, prompt: currentPrompt });
                        return canvasResult;
                    }

                    if (studyMatch && studyMatch[1]) { 
                        currentAction = 'STUDY'; 
                        currentPrompt = studyMatch[1]; 
                        continue; 
                    }
                    
                    if (!finalResponseText.trim() && fallbackSearchContext) {
                        finalResponseText = fallbackSearchContext;
                        onStreamChunk?.(fallbackSearchContext);
                    }

                    return { messages: [{ project_id: project.id, chat_id: chat.id, sender: 'ai', text: finalResponseText, ...metadataPayload }] };
                }
            }
        }
        
        return { messages: [{ project_id: project.id, chat_id: chat.id, sender: 'ai', text: finalResponseText, ...metadataPayload }] };

    } catch (error: any) {
        if (error.name === 'AbortError') {
            return { messages: [{ project_id: project.id, chat_id: chat.id, sender: 'ai', text: finalResponseText || "(Generation stopped by user)" }] };
        }
        console.error("Error in runAutonomousAgent:", error);
        
        const errorMessage = getUserFriendlyError(error);
        return { messages: [{ project_id: project.id, chat_id: chat.id, sender: 'ai', text: `⚠️ ${errorMessage}` }] };
    }
};
