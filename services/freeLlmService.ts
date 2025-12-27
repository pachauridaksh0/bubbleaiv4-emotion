
import { Message } from "../types";

// Global declaration for Puter.js
declare global {
    interface Window {
        puter?: any;
    }
}

const SYSTEM_PROMPT = `You are Bubble, a helpful, friendly, and intelligent AI assistant. 
You are currently in "Instant Mode".
- Be concise and direct.
- Use a warm, conversational tone.
- Do not hallucinate features you don't have access to.
`;

// Helper to wait for Puter script to load
const waitForPuter = async (retries = 20, delay = 200): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    for (let i = 0; i < retries; i++) {
        if (window.puter) return true;
        await new Promise(r => setTimeout(r, delay));
    }
    return false;
};

interface FreeGenerationResult {
    text: string;
    modelUsed: string;
}

// 1. Puter.js Strategy (Fastest, Client-side)
const tryPuter = async (fullPrompt: string, onStream?: (chunk: string) => void): Promise<FreeGenerationResult> => {
    // Wait for library to initialize
    const isLoaded = await waitForPuter();
    
    if (isLoaded && window.puter) {
        console.log("Attempting Puter.js generation...");
        try {
            // Puter AI Chat Call
            const resp = await window.puter.ai.chat(fullPrompt);
            
            // Handle different response shapes from Puter V2
            let text = "";
            let model = "Instant (Auto)";

            if (typeof resp === 'string') {
                text = resp;
            } else if (resp && typeof resp === 'object') {
                text = resp.message?.content || resp.content || resp.toString();
                // Try to extract model name if provided
                if (resp.model) {
                    model = `Instant (${resp.model})`; 
                }
            }
            
            if (!text) throw new Error("Empty response from Puter");
            
            // Simulate streaming since Puter returns bulk
            if (onStream) {
                const chunkSize = 8;
                for (let i = 0; i < text.length; i += chunkSize) {
                    onStream(text.slice(i, i + chunkSize));
                    await new Promise(r => setTimeout(r, 5));
                }
            }
            return { text, modelUsed: model };
        } catch (e) {
            console.warn("Puter.js failed:", e);
            throw new Error("Puter AI failed to respond");
        }
    }
    throw new Error("Puter.js not loaded after timeout");
};

// 2. Hugging Face Public Inference (Backup)
const tryHuggingFace = async (messages: { role: string, content: string }[], onStream?: (chunk: string) => void): Promise<FreeGenerationResult> => {
    console.log("Attempting Hugging Face fallback...");
    // We use a popular, generally available model like Phi-3 or similar free tier
    const model = "microsoft/Phi-3-mini-4k-instruct"; 
    
    // Construct a single prompt string as public endpoints vary in chat template support
    let prompt = "";
    messages.forEach(m => {
        prompt += `<|${m.role}|>\n${m.content}<|end|>\n`;
    });
    prompt += "<|assistant|>\n";

    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                inputs: prompt,
                parameters: {
                    max_new_tokens: 512,
                    return_full_text: false,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) throw new Error(`HF Status: ${response.status}`);
        
        const result = await response.json();
        // HF returns array of objects [{ generated_text: "..." }]
        const text = Array.isArray(result) ? result[0]?.generated_text : result?.generated_text;
        
        if (!text) throw new Error("Empty response from HF");

        if (onStream) {
            const chunkSize = 8;
            for (let i = 0; i < text.length; i += chunkSize) {
                onStream(text.slice(i, i + chunkSize));
                await new Promise(r => setTimeout(r, 5));
            }
        }
        return { text, modelUsed: `HF (${model})` };

    } catch (e) {
        console.warn("Hugging Face failed:", e);
        throw e;
    }
};

// 3. Legacy API (Last Resort)
const tryLegacyApi = async (fullPayload: string, onStream?: (chunk: string) => void): Promise<FreeGenerationResult> => {
    console.log("Attempting Legacy API fallback...");
    try {
        const response = await fetch('https://apifreellm.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: fullPayload })
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();

        if (data.status === 'success') {
            const aiText = data.response;
            if (onStream) {
                const chunkSize = 4;
                for (let i = 0; i < aiText.length; i += chunkSize) {
                    onStream(aiText.slice(i, i + chunkSize));
                    await new Promise(r => setTimeout(r, 15));
                }
            }
            return { text: aiText, modelUsed: 'Legacy API' };
        } else {
            throw new Error(data.error || 'API returned error status');
        }
    } catch (e) {
        console.warn("Legacy API failed:", e);
        throw e;
    }
};

export const generateFreeCompletion = async (
    messages: { role: string; content: string }[], 
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    memoryContext?: string
): Promise<FreeGenerationResult> => {
    
    // Prepare Prompt
    let fullPayload = SYSTEM_PROMPT;
    if (memoryContext && memoryContext.length > 10) {
        fullPayload += `\n\n=== USER MEMORY & CONTEXT ===\n${memoryContext}\n`;
    }
    fullPayload += `\n\n=== CONVERSATION ===\n`;
    const conversationPrompt = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    fullPayload += conversationPrompt;
    fullPayload += `\n\nAssistant:`;

    // 1. Try Puter
    try {
        return await tryPuter(fullPayload, onStream);
    } catch (puterError) {
        // 2. Try Hugging Face
        try {
            return await tryHuggingFace(messages, onStream);
        } catch (hfError) {
            // 3. Try Legacy
            try {
                return await tryLegacyApi(fullPayload, onStream);
            } catch (legacyError: any) {
                const errorMsg = "Instant AI services are currently busy. Please try again or use a Standard model.";
                if (onStream) onStream(errorMsg);
                return { text: errorMsg, modelUsed: 'Error' };
            }
        }
    }
};

export const generateFreeTitle = async (userMessage: string, aiResponse: string): Promise<string> => {
    const words = userMessage.split(' ').slice(0, 5).join(' ');
    const title = words.charAt(0).toUpperCase() + words.slice(1);
    return title.length > 0 ? title : "New Chat";
};
