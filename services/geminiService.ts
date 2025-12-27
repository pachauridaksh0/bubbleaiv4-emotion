
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ProjectType, Message, ImageModel } from "../types";
import { generateFreeTitle } from "./freeLlmService";

// Helper for retries
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const handleGeminiError = (error: any, context: string): never => {
    console.error(`${context}:`, error); 

    const geminiError = error?.error;
    const errorMessage = geminiError?.message || (error instanceof Error ? error.message : JSON.stringify(error));

    if (errorMessage.includes('Rpc failed') || errorMessage.includes('fetch')) {
        throw new Error(`AI service connection failed. Please check your internet connection and disable any browser extensions (like ad-blockers), then try again.`);
    }

    if (errorMessage.includes('API key not valid')) {
        throw new Error("Your API key is not valid. Please check it in your settings.");
    }
    if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        throw new Error("You've exceeded your API quota. Please try again later.");
    }
    
    throw new Error(`An error occurred in ${context.toLowerCase()}. Details: ${errorMessage}`);
};

export const validateApiKey = async (apiKey: string): Promise<{ success: boolean, message?: string }> => {
    if (!apiKey) {
        return { success: false, message: "API key cannot be empty." };
    }
    const ai = new GoogleGenAI({ apiKey: apiKey });

    try {
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "test",
        });
        return { success: true };
    } catch (error: any) {
        console.error("API Key validation failed:", error);
        let message = "An unknown error occurred during validation.";
        
        const errorMsg = error?.message || JSON.stringify(error);

        if (errorMsg.includes('API key not valid')) {
             message = "The provided API key is not valid. Please ensure it is correct and has not expired.";
        } else if (errorMsg.includes('Rpc failed') || errorMsg.includes('fetch')) {
             message = "Could not connect to the AI service. Please check your internet connection and disable any ad-blockers.";
        } else if (errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
             console.warn("Validation hit quota limit, but key is valid. Allowing save.");
             return { success: true }; 
        } else if (errorMsg.includes('permission')) {
             message = "The API key does not have permission for this operation. Please check its permissions.";
        } else {
             message = `Validation failed: ${errorMsg}`;
        }
        
        return { success: false, message };
    }
};

export const generateProjectDetails = async (prompt: string, apiKey: string): Promise<{ name: string, description: string, project_type: ProjectType }> => {
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the following user prompt and generate a suitable project name, a one-sentence description, and classify the project type. Prompt: "${prompt}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "A concise, creative name for the project." },
                        description: { type: Type.STRING, description: "A one-sentence summary of the project." },
                        project_type: {
                            type: Type.STRING,
                            description: "The project type.",
                            enum: ['roblox_game', 'video', 'story', 'design', 'website', 'presentation', 'document']
                        }
                    },
                    required: ["name", "description", "project_type"]
                }
            }
        });
        
        const responseText = response.text ? response.text.trim() : "";
        if (!responseText) {
            throw new Error("AI service returned an empty response when generating project details.");
        }
        
        // Clean markdown code blocks if present
        const cleanJson = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        return JSON.parse(cleanJson);
    } catch (error) {
        handleGeminiError(error, "Error generating project details");
    }
};

export const classifyUserIntent = async (prompt: string, apiKey: string): Promise<{ intent: 'creative_request' | 'general_query' }> => {
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the following user prompt and classify the intent. The intent can be "creative_request" if the user wants to start a new project (e.g., build a game, create an app) or "general_query" for anything else (e.g., asking a question, simple chat). Prompt: "${prompt}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        intent: {
                            type: Type.STRING,
                            description: "The classified intent.",
                            enum: ['creative_request', 'general_query']
                        }
                    },
                    required: ["intent"]
                }
            }
        });
        
        const responseText = response.text ? response.text.trim() : "";
        if (!responseText) {
            throw new Error("AI service returned an empty response when classifying intent.");
        }
        
        const cleanJson = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        return JSON.parse(cleanJson);
    } catch (error) {
        handleGeminiError(error, "Error classifying user intent");
    }
};

export const generateImage = async (prompt: string, apiKey: string, model: ImageModel = 'nano_banana'): Promise<{ imageBase64: string, fallbackOccurred: boolean }> => {
    const ai = new GoogleGenAI({ apiKey });
    let fallbackOccurred = false;

    if (model === 'imagen_2' || model === 'imagen_3' || model === 'imagen_4') {
        try {
            console.log(`Attempting to generate image with Imagen model for prompt: "${prompt}"`);
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    aspectRatio: '1:1',
                },
            });
            if (response.generatedImages && response.generatedImages.length > 0) {
                return { imageBase64: response.generatedImages[0].image.imageBytes, fallbackOccurred: false }; 
            }
            console.warn("Imagen model returned an empty response. Falling back to Nano Banana.");
        } catch (error) {
            console.warn(`Error generating image with Imagen model: ${error instanceof Error ? error.message : String(error)}. Falling back to Nano Banana.`);
        }
        fallbackOccurred = true;
    }
    
    try {
        console.log(`Attempting/Falling back to generate image with Nano Banana for prompt: "${prompt}"`);
        const safePrompt = typeof prompt === 'string' ? prompt : String(prompt);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: safePrompt }]
                }
            ],
            config: { responseModalities: [Modality.IMAGE] },
        });

        if (!response) throw new Error("No response received from AI service.");

        const candidates = response.candidates;
        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
             throw new Error("The AI service could not generate an image for this prompt. It may have been flagged by safety filters.");
        }
        
        const firstCandidate = candidates[0];
        if (!firstCandidate || !firstCandidate.content) {
             throw new Error("Candidate content is missing.");
        }
        
        const parts = firstCandidate.content.parts;
        if (!parts || !Array.isArray(parts) || parts.length === 0) {
             throw new Error("Content parts are missing.");
        }

        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                return { imageBase64: part.inlineData.data, fallbackOccurred }; 
            }
        }
        throw new Error("Nano Banana model did not return an image. The prompt might have been blocked or the service is busy.");
    } catch (error) {
        handleGeminiError(error, "Error generating image");
    }
};

export const generateChatTitle = async (
  firstUserMessage: string,
  firstAiResponse: string,
  apiKey?: string | null
): Promise<string> => {
  // Ultra-safe local fallback generator
  const createLocalTitle = (text: string) => {
      if (!text) return "New Chat";
      const clean = text.replace(/<[^>]*>/g, '').trim();
      const words = clean.split(/\s+/).slice(0, 4);
      if (words.length === 0) return "New Chat";
      const title = words.join(' ');
      return title.length > 25 ? title.substring(0, 25) + "..." : title;
  };

  const fallbackTitle = createLocalTitle(firstUserMessage);
  
  if (!apiKey) {
      return fallbackTitle;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Truncate inputs to avoid massive token usage on large pastes
    const userText = firstUserMessage.slice(0, 300);

    const titlePrompt = `
    Generate a very short title (max 4 words) for this conversation.
    USER: "${userText}"
    
    CRITICAL RULES:
    1. Output strictly ONE line.
    2. No quotes.
    3. No prefixes like "Title:".
    4. Max 4 words.
    5. Be specific to the topic.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: titlePrompt,
      config: {
          maxOutputTokens: 20,
          temperature: 0.5,
      }
    });
    
    const responseText = response.text;
    if (!responseText) {
        return fallbackTitle;
    }

    let cleanTitle = responseText.trim()
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/^(Topic:|Title:)\s*/i, '') // Remove prefixes
        .split('\n')[0] // Ensure one line
        .trim();

    if (cleanTitle.length > 40) cleanTitle = cleanTitle.substring(0, 40) + "...";
    if (cleanTitle.length < 2) return fallbackTitle;

    return cleanTitle;
  } catch (error: any) {
    console.warn("Title generation failed, using fallback:", error);
    return fallbackTitle;
  }
};

export const generateSpeech = async (text: string, apiKey: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    
    // Retrieve settings from local storage
    let voiceName = 'Puck';
    try {
        const storedVoice = localStorage.getItem('bubble_tts_voice');
        if (storedVoice) voiceName = JSON.parse(storedVoice);
    } catch (e) {}

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio data received.");
        return base64Audio;
    } catch (error) {
        handleGeminiError(error, "Error generating speech");
    }
};
