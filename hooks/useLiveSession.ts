
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface UseLiveSessionProps {
    apiKey: string;
    model?: string;
    systemInstruction?: string;
    voiceName?: string;
    onClose?: () => void;
}

export const useLiveSession = ({ apiKey, model = 'gemini-2.5-flash-native-audio-preview-09-2025', systemInstruction, voiceName = 'Puck', onClose }: UseLiveSessionProps) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [volume, setVolume] = useState(0);
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const sessionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    // Track cleanup state to prevent race conditions
    const isCleanedUpRef = useRef(false);

    // Helper: Base64 helpers
    const encodeBase64 = (bytes: Uint8Array) => {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    const decodeBase64 = (base64: string) => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };

    const disconnect = useCallback(async () => {
        if (isCleanedUpRef.current) return;
        isCleanedUpRef.current = true;

        console.log("Disconnecting Live Session...");
        setStatus('idle');
        setIsConnected(false);
        setIsSpeaking(false);
        setVolume(0);
        
        // 1. Stop Microphone Stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        // 2. Disconnect Audio Nodes
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (inputSourceRef.current) {
            inputSourceRef.current.disconnect();
            inputSourceRef.current = null;
        }
        
        // 3. Stop & Clear Output Audio
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        sourcesRef.current.clear();
        
        // 4. Close AudioContext
        if (audioContextRef.current) {
            try {
                if (audioContextRef.current.state !== 'closed') {
                    await audioContextRef.current.close();
                }
            } catch (e) {
                console.warn("Error closing audio context", e);
            }
            audioContextRef.current = null;
        }

        // 5. Release Session Ref
        sessionRef.current = null;
        
    }, []);

    const connect = useCallback(async () => {
        if (!apiKey) {
            setError("No API Key provided");
            return;
        }
        
        // If already connected, disconnect first (re-config scenario)
        if (sessionRef.current) {
            await disconnect();
        }

        // Small delay to ensure cleanup processes
        await new Promise(resolve => setTimeout(resolve, 100));

        isCleanedUpRef.current = false;
        setStatus('connecting');
        setError(null);

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // Initialize Audio Output Context (24kHz for high quality output)
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass({ sampleRate: 24000 });
            audioContextRef.current = audioCtx;
            nextStartTimeRef.current = audioCtx.currentTime;

            // Start Live Session
            const sessionPromise = ai.live.connect({
                model,
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
                    },
                    systemInstruction: systemInstruction,
                },
                callbacks: {
                    onopen: async () => {
                        if (isCleanedUpRef.current) return;
                        console.log("Live Session Opened");
                        setIsConnected(true);
                        setStatus('connected');
                        
                        // Start Microphone Input ONLY after connection is open
                        try {
                            const stream = await navigator.mediaDevices.getUserMedia({ 
                                audio: {
                                    sampleRate: 16000,
                                    channelCount: 1,
                                    echoCancellation: true,
                                    autoGainControl: true,
                                    noiseSuppression: true
                                }
                            });
                            streamRef.current = stream;
                            
                            // Input Audio Context (16kHz for Gemini input)
                            const inputCtx = new AudioContextClass({ sampleRate: 16000 });
                            const source = inputCtx.createMediaStreamSource(stream);
                            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                            
                            processor.onaudioprocess = (e) => {
                                if (isCleanedUpRef.current) return;

                                const inputData = e.inputBuffer.getChannelData(0);
                                
                                // Calculate Volume for Visualizer
                                let sum = 0;
                                for(let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                                const rms = Math.sqrt(sum / inputData.length);
                                setVolume(prev => prev * 0.8 + (rms * 10) * 0.2); 

                                // Convert Float32 to Int16 PCM
                                const pcm16 = new Int16Array(inputData.length);
                                for (let i = 0; i < inputData.length; i++) {
                                    const s = Math.max(-1, Math.min(1, inputData[i]));
                                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                                }
                                
                                const base64Data = encodeBase64(new Uint8Array(pcm16.buffer));
                                
                                // Send to Gemini
                                sessionPromise.then(session => {
                                    if (!isCleanedUpRef.current) {
                                        session.sendRealtimeInput({
                                            media: {
                                                mimeType: 'audio/pcm;rate=16000',
                                                data: base64Data
                                            }
                                        });
                                    }
                                });
                            };
                            
                            source.connect(processor);
                            processor.connect(inputCtx.destination);
                            
                            inputSourceRef.current = source;
                            processorRef.current = processor;
                            
                        } catch (err) {
                            console.error("Mic Error:", err);
                            setError("Microphone access denied");
                            disconnect();
                        }
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        if (isCleanedUpRef.current) return;

                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        
                        if (audioData) {
                            setIsSpeaking(true);
                            const audioBytes = decodeBase64(audioData);
                            const audioCtx = audioContextRef.current;
                            if (!audioCtx) return;

                            // Decode PCM
                            const int16 = new Int16Array(audioBytes.buffer);
                            const float32 = new Float32Array(int16.length);
                            for (let i = 0; i < int16.length; i++) {
                                float32[i] = int16[i] / 32768.0;
                            }

                            const buffer = audioCtx.createBuffer(1, float32.length, 24000);
                            buffer.copyToChannel(float32, 0);

                            const source = audioCtx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(audioCtx.destination);
                            
                            // Visualizer kick
                            setVolume(0.4 + Math.random() * 0.4); 

                            // Schedule seamlessly
                            const now = audioCtx.currentTime;
                            const startTime = Math.max(now, nextStartTimeRef.current);
                            source.start(startTime);
                            nextStartTimeRef.current = startTime + buffer.duration;
                            
                            sourcesRef.current.add(source);
                            source.onended = () => {
                                sourcesRef.current.delete(source);
                                if (sourcesRef.current.size === 0) {
                                    setIsSpeaking(false);
                                    setVolume(0);
                                }
                            };
                        }
                        
                        if (msg.serverContent?.interrupted) {
                            console.log("Model interrupted by user");
                            sourcesRef.current.forEach(s => s.stop());
                            sourcesRef.current.clear();
                            if (audioContextRef.current) {
                                nextStartTimeRef.current = audioContextRef.current.currentTime;
                            }
                            setIsSpeaking(false);
                        }
                    },
                    onclose: (e) => {
                        console.log("Session Closed from Server", e);
                        // Only update state if we haven't already cleaned up
                        if (!isCleanedUpRef.current) {
                            setIsConnected(false);
                            setStatus('idle');
                        }
                    },
                    onerror: (err) => {
                        console.error("Session Error", err);
                        if (!isCleanedUpRef.current) {
                            setError("Connection error: " + (err.message || "Unknown"));
                            setStatus('error');
                        }
                    }
                }
            });
            
            sessionRef.current = sessionPromise;

        } catch (err: any) {
            console.error("Connection Failed", err);
            setError(err.message || "Failed to connect");
            setStatus('error');
        }
    }, [apiKey, model, systemInstruction, voiceName, disconnect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, []);

    return {
        connect,
        disconnect,
        isConnected,
        status,
        volume,
        isSpeaking,
        error
    };
};
