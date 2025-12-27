
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { ChatBubbleLeftRightIcon, CheckCircleIcon, SparklesIcon, ScaleIcon, CommandLineIcon, FaceSmileIcon } from '@heroicons/react/24/solid';
import { emotionEngine } from '../../services/emotionEngine';

const Section: React.FC<{ title: string; children: React.ReactNode; description?: string }> = ({ title, children, description }) => (
    <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <div className="w-16 border-b-2 border-primary-start mt-2 mb-6"></div>
        {description && <p className="text-gray-400 mb-6 max-w-2xl">{description}</p>}
        <div className="space-y-6">{children}</div>
    </div>
);

const SectionCard: React.FC<{children: React.ReactNode}> = ({children}) => (
    <div className="p-6 bg-bg-secondary/50 rounded-xl border border-white/10">{children}</div>
);

const OptionButton: React.FC<{ selected: boolean; onClick: () => void; label: string; desc: string }> = ({ selected, onClick, label, desc }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col text-left p-4 rounded-lg border transition-all duration-200 ${selected ? 'bg-primary-start/20 border-primary-start ring-1 ring-primary-start' : 'bg-black/20 border-white/10 hover:bg-white/5'}`}
    >
        <span className={`font-bold mb-1 ${selected ? 'text-white' : 'text-gray-300'}`}>{label}</span>
        <span className="text-xs text-gray-500">{desc}</span>
    </button>
);

const Slider: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
    <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-gray-300">{label}</label>
            <span className="text-xs text-primary-start font-mono">{value.toFixed(1)}x</span>
        </div>
        <input 
            type="range" 
            min="0.0" 
            max="2.0" 
            step="0.1" 
            value={value} 
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-primary-start"
        />
    </div>
);

export const PersonalitySettings: React.FC = () => {
    const { profile, updateUserProfile, isGuest } = useAuth();
    const { addToast } = useToast();
    const [tone, setTone] = useState<'personalized' | 'serious' | 'ambient'>('personalized');
    const [length, setLength] = useState<'compact' | 'normal' | 'long'>('normal');
    const [customInstructions, setCustomInstructions] = useState('');
    
    // Emotion Engine State
    const [emotionEnabled, setEmotionEnabled] = useState(true);
    const [biases, setBiases] = useState<Record<string, number>>({});

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (profile) {
            setTone(profile.ai_tone || 'personalized');
            setLength(profile.ai_length || 'normal');
            setCustomInstructions(profile.custom_instructions || '');
        }
        
        // Load Emotion Settings
        const engSettings = emotionEngine.getSettings();
        setEmotionEnabled(engSettings.enabled);
        setBiases(engSettings.biases);
    }, [profile]);

    const handleSave = async () => {
        if (!profile || isGuest) return;
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await updateUserProfile({
                ai_tone: tone,
                ai_length: length,
                custom_instructions: customInstructions.trim()
            });
            
            // Save local emotion settings
            emotionEngine.saveSettings({
                enabled: emotionEnabled,
                biases: biases
            });

            setSaveSuccess(true);
            addToast("Persona settings updated successfully.", "success");
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            addToast("Failed to update settings.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleBiasChange = (emotion: string, val: number) => {
        setBiases(prev => ({ ...prev, [emotion]: val }));
    }

    if (isGuest) {
        return (
            <Section title="AI Persona" description="Customize how Bubble talks to you.">
                <SectionCard>
                    <p className="text-gray-400">Settings are disabled in Guest Mode. Sign in to customize your AI's personality.</p>
                </SectionCard>
            </Section>
        )
    }

    return (
        <Section title="AI Persona & Style" description="Control the vibe, verbosity, and emotional behavior of your AI companion.">
            
            {/* Tone Setting */}
            <SectionCard>
                <div className="flex items-center gap-3 mb-4">
                    <SparklesIcon className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-bold text-white">Tone & Vibe</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <OptionButton 
                        selected={tone === 'personalized'} 
                        onClick={() => setTone('personalized')}
                        label="Personalized"
                        desc="Adapts to your mood. Friendly, empathetic, and uses 'we' language."
                    />
                    <OptionButton 
                        selected={tone === 'serious'} 
                        onClick={() => setTone('serious')}
                        label="Serious"
                        desc="Professional, objective, and strictly business. No emojis or fluff."
                    />
                    <OptionButton 
                        selected={tone === 'ambient'} 
                        onClick={() => setTone('ambient')}
                        label="Ambient"
                        desc="Creative, immersive, and relaxed. Uses vivid imagery."
                    />
                </div>
            </SectionCard>
            
            {/* Emotion Engine Settings */}
            <SectionCard>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <FaceSmileIcon className="w-5 h-5 text-yellow-400" />
                        <h3 className="text-lg font-bold text-white">Emotion Engine</h3>
                    </div>
                    <label className="flex items-center cursor-pointer">
                        <span className="mr-3 text-sm font-medium text-gray-300">
                            {emotionEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                className="sr-only" 
                                checked={emotionEnabled} 
                                onChange={(e) => setEmotionEnabled(e.target.checked)} 
                            />
                            <div className={`w-10 h-6 rounded-full shadow-inner transition-colors ${emotionEnabled ? 'bg-primary-start' : 'bg-gray-600'}`}></div>
                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${emotionEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                    </label>
                </div>
                <p className="text-sm text-gray-400 mb-6">
                    Configure the local Emotion Analysis Engine (Qwen 0.5B). Disabling this can improve performance on lower-end devices.
                </p>

                {emotionEnabled && (
                    <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                        <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Emotion Bias Multipliers</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <Slider label="Joy" value={biases['Joy'] ?? 1.0} onChange={(v) => handleBiasChange('Joy', v)} />
                            <Slider label="Curiosity" value={biases['Curiosity'] ?? 1.0} onChange={(v) => handleBiasChange('Curiosity', v)} />
                            <Slider label="Serious" value={biases['Serious'] ?? 1.0} onChange={(v) => handleBiasChange('Serious', v)} />
                            <Slider label="Anger (Detection)" value={biases['Anger'] ?? 1.0} onChange={(v) => handleBiasChange('Anger', v)} />
                        </div>
                    </div>
                )}
            </SectionCard>

            {/* Length Setting */}
            <SectionCard>
                <div className="flex items-center gap-3 mb-4">
                    <ScaleIcon className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-bold text-white">Response Length</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <OptionButton 
                        selected={length === 'compact'} 
                        onClick={() => setLength('compact')}
                        label="Compact"
                        desc="Short, concise, and to the point. Minimal explanation."
                    />
                    <OptionButton 
                        selected={length === 'normal'} 
                        onClick={() => setLength('normal')}
                        label="Normal"
                        desc="Balanced detail. Similar to standard ChatGPT responses."
                    />
                    <OptionButton 
                        selected={length === 'long'} 
                        onClick={() => setLength('long')}
                        label="Extensive"
                        desc="Comprehensive and detailed. Explains everything fully."
                    />
                </div>
            </SectionCard>

            {/* Custom Instructions */}
            <SectionCard>
                <div className="flex items-center gap-3 mb-4">
                    <CommandLineIcon className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-bold text-white">Custom System Instructions</h3>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                    Add specific rules the AI must follow. These are injected into the system prompt but hidden from the chat view.
                </p>
                <textarea 
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="e.g., 'Always address me as Captain.', 'Never use lists.', 'Speak in rhymes.'"
                    className="w-full h-32 bg-black/30 border border-white/10 rounded-lg p-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-start resize-none"
                />
            </SectionCard>

            <div className="pt-6 border-t border-white/10 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving || saveSuccess}
                    className="px-8 h-[48px] bg-primary-start text-white rounded-lg font-bold text-sm hover:bg-primary-start/80 transition-all shadow-lg hover:shadow-primary-start/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSaving ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    : saveSuccess ? <CheckCircleIcon className="h-6 w-6 text-white" />
                    : 'Save Changes'}
                </button>
            </div>
        </Section>
    );
};
