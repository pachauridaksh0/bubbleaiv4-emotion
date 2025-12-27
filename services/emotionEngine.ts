
import { pipeline, env } from '@xenova/transformers';
import { EmotionData } from '../types';

// Configure transformers.js to use the CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

// Mobile detection utility
const isMobile = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export interface EmotionSettings {
    enabled: boolean;
    biases: Record<string, number>; // e.g. { Joy: 1.2 } (multiplier)
}

class EmotionEngine {
    private pipe: any = null;
    private isLoading: boolean = false;
    private modelId = 'Xenova/Qwen1.5-0.5B-Chat'; 
    private progressCallback: ((progress: number) => void) | null = null;
    
    private settings: EmotionSettings = {
        enabled: true,
        biases: {
            Joy: 1.0,
            Curiosity: 1.0,
            Anger: 1.0,
            Sadness: 1.0,
            Serious: 1.0
        }
    };

    constructor() {
        this.loadSettings();
    }

    private loadSettings() {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem('bubble_emotion_settings');
            if (saved) {
                try {
                    this.settings = { ...this.settings, ...JSON.parse(saved) };
                } catch (e) {}
            }
        }
    }

    public saveSettings(newSettings: EmotionSettings) {
        this.settings = newSettings;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('bubble_emotion_settings', JSON.stringify(this.settings));
        }
    }

    public getSettings() {
        return this.settings;
    }

    setProgressCallback(cb: (progress: number) => void) {
        this.progressCallback = cb;
    }

    isModelReady(): boolean {
        return !!this.pipe;
    }

    async init() {
        // PERF: Disable completely on mobile or if user disabled it
        if (isMobile()) {
            console.log("Emotion Engine disabled on mobile device to save battery/performance.");
            return;
        }
        if (!this.settings.enabled) {
            return;
        }

        if (this.pipe) {
            this.progressCallback?.(100);
            return;
        }
        if (this.isLoading) {
            return; // Already loading
        }

        this.isLoading = true;
        
        // Wrap in a promise that resolves immediately to unblock the main thread
        // while the WASM load happens in the next tick
        await new Promise(resolve => setTimeout(resolve, 0));

        try {
            console.log("Initializing Emotion Engine (Qwen 0.5B)...");
            this.pipe = await pipeline('text-generation', this.modelId, {
                quantized: true,
                progress_callback: (data: any) => {
                    if (data.status === 'progress' && this.progressCallback) {
                        const prog = data.progress || 0;
                        this.progressCallback(Math.round(prog));
                    } else if (data.status === 'done' && this.progressCallback) {
                        this.progressCallback(100);
                    }
                }
            });
            console.log("Emotion Engine Ready.");
        } catch (error) {
            console.error("Failed to load Emotion Engine:", error);
        } finally {
            this.isLoading = false;
        }
    }

    async analyze(text: string, previousAiContext?: string, previousEmotionData?: EmotionData): Promise<EmotionData> {
        // 1. Mobile / Disabled Check
        if (isMobile()) {
            return { dominant: 'Neutral (Mobile Mode)', scores: { Neutral: 100 } };
        }
        if (!this.settings.enabled) {
            return { dominant: 'Neutral (Engine Off)', scores: { Neutral: 100 } };
        }

        // 2. Immediate Check - Do not await init here to prevent blocking. 
        // If not ready, return fallback.
        if (!this.pipe) {
             // Trigger background init if not loading
             if (!this.isLoading) this.init().catch(() => {});
             return { dominant: 'Friendly', scores: { Joy: 100 } }; // Force friendly default
        }

        // Optimized Prompt for Speed: Removed verbose instructions to save tokens and processing time
        const systemPrompt = `Analyze emotion.
Emotions: Joy, Anger, Fear, Sadness, Surprise, Curiosity, Serious, Neutral.
Format:
Dominant: [Emotion]
Joy: [N]%
Anger: [N]%
Fear: [N]%
Sadness: [N]%
Surprise: [N]%
Curiosity: [N]%
Serious: [N]%
Neutral: [N]%`;

        let userContext = "";
        if (previousAiContext) {
            // Further truncate context to save tokens
            userContext += `[Prev AI]: "${previousAiContext.substring(0, 100)}..."\n`;
        }
        if (previousEmotionData) {
            userContext += `[Prev Emotion]: ${previousEmotionData.dominant}\n`;
        }
        userContext += `[Input]: "${text}"\n\nAnalyze:`;

        const prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userContext}<|im_end|>\n<|im_start|>assistant\nDominant:`;

        try {
            const output = await this.pipe(prompt, {
                max_new_tokens: 45, // Reduced from 60 to speed up generation
                temperature: 0.1, 
                do_sample: false,
                return_full_text: false
            });

            const generatedText = "Dominant: " + (output[0]?.generated_text || "");
            const result = this.parseOutput(generatedText);
            
            // Apply User Biases
            return this.applyBiases(result);

        } catch (error) {
            console.error("Emotion analysis failed:", error);
            return { dominant: 'Neutral', scores: { Neutral: 100 } };
        }
    }

    private applyBiases(data: EmotionData): EmotionData {
        const biases = this.settings.biases;
        let maxScore = 0;
        let newDominant = data.dominant;

        // Apply multipliers
        for (const [emotion, multiplier] of Object.entries(biases)) {
            if (data.scores[emotion]) {
                data.scores[emotion] = Math.min(100, Math.round(data.scores[emotion] * multiplier));
            }
        }

        // Re-calculate dominant
        for (const [emotion, score] of Object.entries(data.scores)) {
            if (score > maxScore) {
                maxScore = score;
                newDominant = emotion;
            }
        }
        data.dominant = newDominant;
        return data;
    }

    private parseOutput(text: string): EmotionData {
        const scores: Record<string, number> = {
            Joy: 0, Anger: 0, Fear: 0, Sadness: 0, Surprise: 0, Curiosity: 0, Serious: 0, Neutral: 0
        };
        let dominant = 'Neutral';

        try {
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.startsWith('Dominant:')) {
                    dominant = line.split(':')[1].trim();
                } else {
                    const match = line.match(/([a-zA-Z]+):\s*(\d+)%?/);
                    if (match) {
                        const emotion = match[1].trim();
                        const score = parseInt(match[2], 10);
                        if (scores.hasOwnProperty(emotion)) {
                            scores[emotion] = score;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Error parsing emotion output", e);
        }

        if (dominant === 'Neutral' && Object.values(scores).every(v => v === 0)) {
            scores.Neutral = 100;
        }

        return { dominant, scores };
    }
}

export const emotionEngine = new EmotionEngine();
