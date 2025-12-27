
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    PhoneXMarkIcon,
    Cog6ToothIcon,
    ArrowPathIcon,
    MicrophoneIcon,
    SpeakerWaveIcon
} from '@heroicons/react/24/solid';
import { useLiveSession } from '../../hooks/useLiveSession';
import { autonomousInstruction } from '../../agents/autonomous/instructions';
import { useAuth } from '../../contexts/AuthContext';
import { loadMemoriesForPrompt, getMessages } from '../../services/databaseService';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface LiveSessionOverlayProps {
    apiKey: string;
    onClose: () => void;
    chatId?: string;
    project?: any;
}

const VOICES = [
    { id: 'Puck', name: 'Puck (Energetic)' },
    { id: 'Charon', name: 'Charon (Deep)' },
    { id: 'Kore', name: 'Kore (Balanced)' },
    { id: 'Fenrir', name: 'Fenrir (Strong)' },
    { id: 'Aoede', name: 'Aoede (Soft)' },
];

const SPEEDS = [
    { id: 'slow', label: 'Slow', prompt: 'Speak slowly and clearly.' },
    { id: 'normal', label: 'Normal', prompt: 'Speak at a natural, conversational pace.' },
    { id: 'fast', label: 'Fast', prompt: 'Speak quickly and concisely.' },
];

const VisualizerBars = ({ volume, isSpeaking }: { volume: number, isSpeaking: boolean }) => {
    const bars = [0.6, 1, 0.8, 1.2, 0.7];
    const baseColor = isSpeaking ? 'bg-purple-400' : 'bg-white';
    
    return (
        <div className="flex items-end justify-center gap-2 h-32">
            {bars.map((heightFactor, i) => (
                <motion.div
                    key={i}
                    animate={{
                        height: Math.max(10, volume * 200 * heightFactor),
                        opacity: 0.5 + volume * 0.5
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className={`w-6 rounded-full ${baseColor}`}
                />
            ))}
        </div>
    );
};

export const LiveSessionOverlay: React.FC<LiveSessionOverlayProps> = ({ apiKey, onClose, chatId, project }) => {
    const { user, supabase } = useAuth();
    
    // Persist settings using localStorage so they don't reset
    const [voice, setVoice] = useLocalStorage('bubble_live_voice', 'Puck');
    const [speed, setSpeed] = useLocalStorage('bubble_live_speed', 'normal');
    
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [fullSystemInstruction, setFullSystemInstruction] = useState<string | undefined>(undefined);
    const [isContextLoaded, setIsContextLoaded] = useState(false);
    
    // Track connection attempts to prevent loops
    const connectionAttempted = useRef(false);

    useEffect(() => {
        const prepareContext = async () => {
            let memoryContext = "No prior memory.";
            let recentHistory = "";

            if (user) {
                try {
                    memoryContext = await loadMemoriesForPrompt(supabase, user.id, "Current Context", project?.id);
                } catch (e) { console.error("Failed to load memory", e); }

                if (chatId) {
                    try {
                        const msgs = await getMessages(supabase, chatId);
                        const recent = msgs.slice(-5);
                        recentHistory = recent.map(m => `${m.sender.toUpperCase()}: ${m.text}`).join('\n');
                    } catch (e) { console.error("Failed to load history", e); }
                }
            }

            const speedInstruction = SPEEDS.find(s => s.id === speed)?.prompt || '';

            const combinedInstruction = `
${autonomousInstruction}

=== LIVE VOICE CONTEXT ===
You are now in a real-time voice call with the user.
- **STYLE:** ${speedInstruction}
- Be concise. Spoken conversation is faster than text.
- Do NOT use markdown formatting (like tables or bold) in your speech.
- Use the provided memory and history to continue the conversation naturally.

[MEMORY CONTEXT]
${memoryContext}

[RECENT CHAT HISTORY]
${recentHistory}
            `;
            
            setFullSystemInstruction(combinedInstruction);
            setIsContextLoaded(true);
        };

        prepareContext();
    }, [user, supabase, chatId, project, speed]);

    const { connect, disconnect, status, volume, isSpeaking, error } = useLiveSession({
        apiKey,
        onClose,
        systemInstruction: fullSystemInstruction,
        voiceName: voice
    });

    // Auto-connect when context is ready or settings change
    // This effect handles the "reconnect on settings change" requirement smoothly
    useEffect(() => {
        if (isContextLoaded && fullSystemInstruction) {
            // If already connected, this acts as a reconnect due to prop changes in useLiveSession
            // If not connected, it initiates the first connection
            connect();
        }
    }, [isContextLoaded, fullSystemInstruction, voice, connect]);

    const handleDisconnect = () => {
        disconnect();
        onClose();
    };

    const handleRetry = () => {
        connect();
    };

    // Local status mapping to handle UI feedback better
    const [statusDisplay, setStatusDisplay] = useState(status);
    useEffect(() => setStatusDisplay(status), [status]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden"
        >
            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse transition-colors duration-1000 ${isSpeaking ? 'bg-purple-900/30' : 'bg-blue-900/30'}`}></div>
            </div>

            {/* Top Bar */}
            <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-20">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Bubble Live</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${statusDisplay === 'connected' ? 'bg-green-400 animate-pulse' : statusDisplay === 'connecting' ? 'bg-yellow-400 animate-bounce' : 'bg-gray-500'}`} />
                        <span className="text-sm text-gray-400 capitalize">{statusDisplay === 'error' ? 'Disconnected' : statusDisplay}</span>
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md"
                >
                    <Cog6ToothIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="absolute top-24 right-8 w-72 bg-zinc-900/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl z-30 shadow-2xl"
                    >
                        <h3 className="text-white font-semibold mb-4">Audio Settings</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2 block">Voice</label>
                                <div className="grid gap-2">
                                    {VOICES.map(v => (
                                        <button
                                            key={v.id}
                                            onClick={() => { 
                                                setVoice(v.id); 
                                                // Trigger reconnect visually by closing settings
                                                setIsSettingsOpen(false); 
                                            }}
                                            className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${voice === v.id ? 'bg-primary-start text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                                        >
                                            {v.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2 block">Speaking Speed</label>
                                <div className="flex bg-white/5 rounded-lg p-1">
                                    {SPEEDS.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => { 
                                                setSpeed(s.id);
                                                setIsSettingsOpen(false); 
                                            }}
                                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${speed === s.id ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Central Content */}
            <div className="relative flex items-center justify-center w-full h-full z-10">
                {!isContextLoaded ? (
                    <div className="text-gray-500 animate-pulse text-lg">Initializing Context...</div>
                ) : statusDisplay === 'error' ? (
                    <div className="text-center">
                        <p className="text-red-400 mb-6 bg-red-500/10 px-6 py-3 rounded-lg border border-red-500/20 max-w-md mx-auto">
                            {error || "Connection lost. Please try again."}
                        </p>
                        <button 
                            onClick={handleRetry}
                            className="flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white font-medium transition-colors mx-auto"
                        >
                            <ArrowPathIcon className="w-5 h-5" /> Retry Connection
                        </button>
                    </div>
                ) : statusDisplay === 'connecting' ? (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 border-4 border-t-primary-start border-white/10 rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-400">Establishing Uplink...</p>
                    </div>
                ) : (
                    <VisualizerBars volume={volume} isSpeaking={isSpeaking} />
                )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-12 flex items-center gap-8 z-10">
                <button className="p-5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md opacity-50 cursor-not-allowed">
                    <MicrophoneIcon className="w-7 h-7" />
                </button>
                <button 
                    onClick={handleDisconnect}
                    className="p-7 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-2xl hover:scale-105 transition-all"
                    title="End Call"
                >
                    <PhoneXMarkIcon className="w-9 h-9" />
                </button>
                <button className="p-5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md opacity-50 cursor-not-allowed">
                    <SpeakerWaveIcon className="w-7 h-7" />
                </button>
            </div>
        </motion.div>
    );
};
