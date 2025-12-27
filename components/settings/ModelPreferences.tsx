
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { ChatModel, ImageModel } from '../../types';
import { CheckCircleIcon, BoltIcon, ArrowPathIcon, MagnifyingGlassIcon, CpuChipIcon, ChatBubbleLeftEllipsisIcon, PlusIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';

const Section: React.FC<{ title: string; children: React.ReactNode; description?: string; action?: React.ReactNode }> = ({ title, children, description, action }) => (
    <div>
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            {action}
        </div>
        <div className="w-16 border-b-2 border-primary-start mt-2 mb-6"></div>
        {description && <p className="text-gray-400 mb-6 max-w-2xl">{description}</p>}
        <div className="space-y-6">{children}</div>
    </div>
);

const SectionCard: React.FC<{children: React.ReactNode, className?: string}> = ({children, className = ""}) => (
    <div className={`p-6 bg-bg-secondary/50 rounded-xl border border-white/10 ${className}`}>{children}</div>
);

interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    context_length?: number;
    pricing?: {
        prompt: string;
        completion: string;
    };
    architecture?: {
        modality?: string;
    }
}

const getProviderName = (modelId: string) => {
    const parts = modelId.split('/');
    if (parts.length > 1) {
        // Capitalize first letter
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return 'Unknown';
}

const formatPrice = (priceStr: string | undefined) => {
    if (!priceStr) return 'Unknown';
    const price = parseFloat(priceStr);
    if (price === 0) return <span className="text-green-400 font-bold">Free</span>;
    return `$${(price * 1000000).toFixed(2)}`;
}

const ModelCard: React.FC<{ 
    model: OpenRouterModel; 
    isEnabled: boolean; 
    onToggle: () => void 
}> = ({ model, isEnabled, onToggle }) => {
    const provider = getProviderName(model.id);
    
    return (
        <div className={`p-4 rounded-lg border transition-all duration-200 ${isEnabled ? 'bg-primary-start/10 border-primary-start' : 'bg-bg-tertiary border-white/5 hover:border-white/20'}`}>
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/10 rounded text-gray-300">{provider}</span>
                        {model.context_length && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-white/10 rounded text-blue-300">
                                {Math.round(model.context_length / 1024)}k Ctx
                            </span>
                        )}
                    </div>
                    <h4 className="font-bold text-white text-sm truncate" title={model.name}>{model.name}</h4>
                    <p className="text-xs text-gray-500 truncate" title={model.id}>{model.id}</p>
                </div>
                <button
                    onClick={onToggle}
                    className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${isEnabled ? 'bg-primary-start text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`}
                >
                    {isEnabled ? <CheckCircleIcon className="w-5 h-5" /> : <PlusIcon className="w-5 h-5" />}
                </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-white/5 pt-2">
                <div title="Input cost per 1M tokens">In: {formatPrice(model.pricing?.prompt)}</div>
                <div title="Output cost per 1M tokens">Out: {formatPrice(model.pricing?.completion)}</div>
            </div>
        </div>
    );
};

export const ModelPreferences: React.FC = () => {
    const { profile, updateUserProfile, openRouterApiKey } = useAuth();
    const { addToast } = useToast();
    
    // Settings State
    const [chatModel, setChatModel] = useState<ChatModel>('gemini-2.5-flash');
    const [codeModel, setCodeModel] = useState<ChatModel>('gemini-2.5-flash');
    const [deepModel, setDeepModel] = useState<string>('gemini-2.5-flash');
    const [imageModel, setImageModel] = useState<ImageModel>('nano_banana');
    
    // OpenRouter State
    const [enabledModels, setEnabledModels] = useState<string[]>([]);
    const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'config' | 'library'>('config');

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Load initial state from profile
    useEffect(() => {
        if (profile) {
            // Normalize legacy underscore models on load for display
            let loadedChatModel = profile.preferred_chat_model || 'gemini-2.5-flash';
            if (loadedChatModel.includes('_')) loadedChatModel = loadedChatModel.replace(/_/g, '-');
            setChatModel(loadedChatModel);

            let loadedCodeModel = profile.preferred_code_model || profile.preferred_chat_model || 'gemini-2.5-flash';
            if (loadedCodeModel.includes('_')) loadedCodeModel = loadedCodeModel.replace(/_/g, '-');
            setCodeModel(loadedCodeModel);

            let loadedDeepModel = profile.preferred_deep_model || 'gemini-2.5-flash';
            if (loadedDeepModel.includes('_')) loadedDeepModel = loadedDeepModel.replace(/_/g, '-');
            setDeepModel(loadedDeepModel);

            setImageModel(profile.preferred_image_model || 'nano_banana');
            
            // Ensure enabledModels is an array
            const savedEnabledModels = profile.enabled_openrouter_models;
            if (Array.isArray(savedEnabledModels)) {
                setEnabledModels(savedEnabledModels);
            } else {
                setEnabledModels([]);
            }
        }
    }, [profile]);

    const fetchOpenRouterModels = async () => {
        if (!openRouterApiKey) return;
        setIsLoadingModels(true);
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${openRouterApiKey}`,
                }
            });
            const data = await response.json();
            if (data && data.data) {
                // Filter for text/chat models primarily
                const textModels = data.data; 
                // Sort by name
                const sorted = textModels.sort((a: any, b: any) => a.name.localeCompare(b.name));
                setAvailableModels(sorted);
            }
        } catch (e) {
            console.error("Failed to fetch OpenRouter models", e);
            addToast("Could not fetch OpenRouter models", "error");
        } finally {
            setIsLoadingModels(false);
        }
    };

    useEffect(() => {
        if (openRouterApiKey && viewMode === 'library' && availableModels.length === 0) {
            fetchOpenRouterModels();
        }
    }, [openRouterApiKey, viewMode]);
    
    const handleSave = async () => {
        if (!profile) return;
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await updateUserProfile({
                preferred_chat_model: chatModel,
                preferred_code_model: codeModel,
                preferred_deep_model: deepModel,
                preferred_image_model: imageModel,
                enabled_openrouter_models: enabledModels
            });
            setSaveSuccess(true);
            addToast("Model preferences saved!", "success");
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error: any) {
            console.error("Save preferences failed:", error);
            let msg = "Unknown error";
            if (typeof error === 'string') msg = error;
            else if (error instanceof Error) msg = error.message;
            else if (error?.message) msg = error.message;
            else try { 
                // Fallback for unknown objects, preventing [object Object]
                const str = JSON.stringify(error);
                if (str !== '{}') msg = "Detailed error logged to console.";
            } catch {}
            
            addToast(`Failed to save preferences: ${msg}`, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleModel = (modelId: string) => {
        setEnabledModels(prev => {
            if (prev.includes(modelId)) {
                return prev.filter(id => id !== modelId);
            } else {
                return [...prev, modelId];
            }
        });
    };

    const filteredModels = useMemo(() => {
        if (!searchQuery.trim()) return availableModels;
        const lowerQuery = searchQuery.toLowerCase();
        return availableModels.filter(m => 
            m.name.toLowerCase().includes(lowerQuery) || 
            m.id.toLowerCase().includes(lowerQuery) ||
            (m.id.split('/')[0] || '').toLowerCase().includes(lowerQuery)
        );
    }, [availableModels, searchQuery]);

    // Create options for dropdowns
    const getModelOptions = () => {
        const nativeOptions = [
            { value: "gemini-3-flash-preview", label: "Native: Gemini 3 Flash" },
            { value: "gemini-2.5-flash", label: "Native: Gemini 2.5 Flash" },
            { value: "gemini-1.5-flash", label: "Native: Gemini 1.5 Flash" },
            { value: "gemini-3-pro-preview", label: "Native: Gemini 3 Pro Preview" },
        ];

        // Add enabled OpenRouter models
        const openRouterOptions = enabledModels.map(id => {
            // Try to find full model info if we have it loaded, otherwise fallback to ID formatting
            const modelInfo = availableModels.find(m => m.id === id);
            const name = modelInfo ? modelInfo.name : id.split('/').pop();
            const provider = id.split('/')[0];
            // Add a visual indicator for OR models
            return { 
                value: id, 
                label: `☁️ ${provider}/${name}` 
            };
        });

        return { nativeOptions, openRouterOptions };
    };

    const { nativeOptions, openRouterOptions } = getModelOptions();
    const allModelOptions = [...nativeOptions, ...openRouterOptions];

    return (
        <div>
            <div className="flex space-x-1 bg-black/20 p-1 rounded-lg mb-6 w-fit">
                <button
                    onClick={() => setViewMode('config')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'config' ? 'bg-primary-start text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    Configuration
                </button>
                <button
                    onClick={() => setViewMode('library')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'library' ? 'bg-primary-start text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    Model Library
                </button>
            </div>

            {viewMode === 'config' ? (
                <Section 
                    title="Active Model Assignment" 
                    description="Assign which models handle specific tasks in the application. Use the Model Library tab to add more options."
                >
                    {/* Chat Preferences */}
                    <SectionCard className="relative overflow-hidden">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-blue-500/20 rounded-lg"><ChatBubbleLeftEllipsisIcon className="w-6 h-6 text-blue-400"/></div>
                            <div className="flex-1">
                                <label htmlFor="chatModel" className="block text-lg font-medium text-white mb-1">Chat Agent Model</label>
                                <p className="text-sm text-gray-400 mb-4">Used for general conversation, brainstorming, and non-technical queries.</p>
                                <select
                                    id="chatModel"
                                    value={chatModel}
                                    onChange={(e) => setChatModel(e.target.value as ChatModel)}
                                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    <optgroup label="Native Models">
                                        {nativeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </optgroup>
                                    {openRouterOptions.length > 0 && (
                                        <optgroup label="OpenRouter Models">
                                            {openRouterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Coding Preferences */}
                    <SectionCard className="relative overflow-hidden">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-purple-500/20 rounded-lg"><CpuChipIcon className="w-6 h-6 text-purple-400"/></div>
                            <div className="flex-1">
                                <label htmlFor="codeModel" className="block text-lg font-medium text-white mb-1">Build & Code Agent Model</label>
                                <p className="text-sm text-gray-400 mb-4">Used for writing code, generating file structures, and technical planning.</p>
                                <select
                                    id="codeModel"
                                    value={codeModel}
                                    onChange={(e) => setCodeModel(e.target.value as ChatModel)}
                                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                >
                                    <optgroup label="Native Models">
                                        {nativeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </optgroup>
                                    {openRouterOptions.length > 0 && (
                                        <optgroup label="OpenRouter Models">
                                            {openRouterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Deep Think Preferences */}
                    <SectionCard className="relative overflow-hidden">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-indigo-500/20 rounded-lg"><SparklesIcon className="w-6 h-6 text-indigo-400"/></div>
                            <div className="flex-1">
                                <label htmlFor="deepModel" className="block text-lg font-medium text-white mb-1">Deep Think Agent Model</label>
                                <p className="text-sm text-gray-400 mb-4">Used when you select "Deep Think" mode for complex reasoning tasks. Select <strong>Gemini 3 Pro</strong> if you have a paid API key, or stick to <strong>Flash</strong> for free usage.</p>
                                <select
                                    id="deepModel"
                                    value={deepModel}
                                    onChange={(e) => setDeepModel(e.target.value)}
                                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                >
                                    <optgroup label="Native Models">
                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Free Tier Recommended)</option>
                                        <option value="gemini-3-flash-preview">Gemini 3 Flash (New & Fast)</option>
                                        <option value="gemini-3-pro-preview">Gemini 3 Pro Preview (Paid API Recommended)</option>
                                        {nativeOptions.filter(o => o.value !== 'gemini-2.5-flash' && o.value !== 'gemini-3-pro-preview' && o.value !== 'gemini-3-flash-preview').map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </optgroup>
                                    {openRouterOptions.length > 0 && (
                                        <optgroup label="OpenRouter Models">
                                            {openRouterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Image Preferences */}
                    <SectionCard>
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-pink-500/20 rounded-lg"><BoltIcon className="w-6 h-6 text-pink-400"/></div>
                            <div className="flex-1">
                                <label htmlFor="imageModel" className="block text-lg font-medium text-white mb-1">Image Generation Model</label>
                                <p className="text-sm text-gray-400 mb-4">Used when you ask the AI to create visuals.</p>
                                <select
                                    id="imageModel"
                                    value={imageModel}
                                    onChange={(e) => setImageModel(e.target.value as ImageModel)}
                                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                                >
                                    <option value="nano_banana">Nano Banana (Fast &amp; Cheap)</option>
                                    <option value="imagen_2">Imagen 2 (Balanced)</option>
                                    <option value="imagen_3">Imagen 3 (High Quality)</option>
                                    <option value="imagen_4">Imagen 4 (Highest Quality)</option>
                                </select>
                            </div>
                        </div>
                    </SectionCard>

                    <div className="pt-6 border-t border-border-color flex justify-end sticky bottom-0 bg-bg-primary/90 p-4 -mx-4 -mb-4 backdrop-blur-md border-t border-white/10">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || saveSuccess}
                            className="px-8 h-[48px] bg-primary-start text-white rounded-lg font-bold text-sm hover:bg-primary-start/80 transition-all shadow-lg hover:shadow-primary-start/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            : saveSuccess ? <CheckCircleIcon className="h-6 w-6 text-white" />
                            : 'Save Assignments'}
                        </button>
                    </div>
                </Section>
            ) : (
                <Section 
                    title="Model Library" 
                    description="Discover and enable models from OpenRouter to use in Bubble. Enabled models will appear in the Configuration tab."
                    action={
                        <div className="flex gap-2">
                             {!openRouterApiKey && (
                                <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded border border-yellow-400/20 flex items-center gap-1">
                                    <BoltIcon className="w-3 h-3" /> Key Missing
                                </span>
                            )}
                            <button 
                                onClick={fetchOpenRouterModels} 
                                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md text-white flex items-center gap-1 transition-colors"
                                disabled={isLoadingModels || !openRouterApiKey}
                            >
                                <ArrowPathIcon className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                    }
                >
                    {!openRouterApiKey ? (
                        <div className="p-8 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-center">
                            <BoltIcon className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">OpenRouter Key Required</h3>
                            <p className="text-gray-400 mb-4">Please add your OpenRouter API key in the "API Keys" tab to access the model library.</p>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search models by name or provider (e.g. 'claude', 'meta', 'free')..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-start placeholder-gray-600 transition-all"
                                />
                            </div>

                            {isLoadingModels ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-24 bg-bg-secondary/50 rounded-lg animate-pulse border border-white/5"></div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {filteredModels.length > 0 ? (
                                        filteredModels.map(model => (
                                            <ModelCard 
                                                key={model.id} 
                                                model={model} 
                                                isEnabled={enabledModels.includes(model.id)} 
                                                onToggle={() => toggleModel(model.id)} 
                                            />
                                        ))
                                    ) : (
                                        <div className="col-span-full text-center py-12 text-gray-500">
                                            <p>No models found matching your search.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Quick Save for Library Changes */}
                            {enabledModels.length !== (profile?.enabled_openrouter_models?.length || 0) && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="sticky bottom-4 flex justify-center"
                                >
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="px-6 py-3 bg-primary-start text-white rounded-full font-bold shadow-2xl hover:bg-primary-start/90 hover:scale-105 transition-all flex items-center gap-2"
                                    >
                                        {isSaving ? 'Saving...' : `Save ${enabledModels.length} Enabled Models`}
                                    </button>
                                </motion.div>
                            )}
                        </>
                    )}
                </Section>
            )}
        </div>
    );
};
