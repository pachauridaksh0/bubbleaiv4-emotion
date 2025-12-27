
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { validateApiKey } from '../../services/geminiService';
import { validateOpenRouterKey } from '../../services/openRouterService';
import { KeyIcon, ExclamationTriangleIcon, BoltIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

export const ApiKeySetupPage: React.FC = () => {
    const { saveGeminiApiKey, saveOpenRouterApiKey } = useAuth();
    const [geminiKey, setGeminiKey] = useState('');
    const [openRouterKey, setOpenRouterKey] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        // Require at least one key, but Gemini is the primary for now.
        if ((!geminiKey.trim() && !openRouterKey.trim()) || isValidating) {
            setValidationError("Please provide at least one API key to continue.");
            return;
        }
        
        setIsValidating(true);
        setValidationError(null);

        try {
            // Validate Gemini if present
            if (geminiKey.trim()) {
                const geminiResult = await validateApiKey(geminiKey);
                if (!geminiResult.success) {
                    throw new Error(`Gemini: ${geminiResult.message}`);
                }
                await saveGeminiApiKey(geminiKey);
            }

            // Validate OpenRouter if present
            if (openRouterKey.trim()) {
                const routerResult = await validateOpenRouterKey(openRouterKey);
                if (!routerResult.success) {
                    throw new Error(`OpenRouter: ${routerResult.message}`);
                }
                await saveOpenRouterApiKey(openRouterKey);
            }

            // If we get here, all provided keys are valid and saved.
            // AuthContext state updates will trigger navigation in App.tsx
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Validation failed. Please try again.';
            setValidationError(errorMessage);
        } finally {
            setIsValidating(false);
        }
    };

    const handleSkip = () => {
        // Saving an empty string or a specific flag could work, 
        // but here we just need to satisfy the App.tsx check.
        // We'll save a dummy value to local storage or context if needed, 
        // but typically just not having it triggers this page.
        // To bypass, we can set a flag in the AuthContext or just let them proceed 
        // assuming the context handles "isSkipped". 
        // For now, we will simulate saving a blank state that the App recognizes as "User chose to skip".
        // A better approach is to have a method in AuthContext, but we can hack it by saving a specific marker.
        // However, the cleanest way without changing Context interface deeply is to rely on the App.tsx check.
        // Let's assume the user wants to use "Instant Mode" exclusively.
        // We will trigger a state update in AuthContext if possible, otherwise reload.
        
        // Actually, let's just use the `continueAsGuest` logic or similar, 
        // but since they are logged in, we just need to tell the app to stop showing this page.
        // We will save a "skipped" flag to localStorage.
        localStorage.setItem('bubble_api_skipped', 'true');
        window.location.reload(); // Simple reload to re-evaluate App.tsx logic
    };

    return (
        <div className="flex items-center justify-center h-screen bg-bg-primary text-white p-4">
            <motion.div
                {...{
                  initial: { scale: 0.95, opacity: 0, y: 20 },
                  animate: { scale: 1, opacity: 1, y: 0 },
                  transition: { duration: 0.3 },
                }}
                className="w-full max-w-md p-8 bg-bg-secondary/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
            >
                <div className="text-center">
                    <KeyIcon className="w-10 h-10 mx-auto text-primary-start mb-4" />
                    <h1 className="text-3xl font-bold text-white mb-2">API Setup</h1>
                    <p className="text-gray-400 mb-6">Enter your API keys to power the full AI experience. You can add them later in settings.</p>
                </div>
                
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1 ml-1">Google Gemini (Recommended)</label>
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="Gemini API Key"
                            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-start transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1 ml-1">OpenRouter (Optional)</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={openRouterKey}
                                onChange={(e) => setOpenRouterKey(e.target.value)}
                                placeholder="OpenRouter API Key"
                                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                            />
                            <BoltIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400 pointer-events-none" />
                        </div>
                    </div>

                    {validationError && (
                        <motion.p 
                            {...{initial: { opacity: 0, y: -10 }, animate: { opacity: 1, y: 0 }}} 
                            className="text-red-400 text-sm mt-3 text-left flex items-start gap-2 bg-red-500/10 p-2 rounded"
                        >
                            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <span>{validationError}</span>
                        </motion.p>
                    )}

                    <button
                        type="submit"
                        disabled={(!geminiKey.trim() && !openRouterKey.trim()) || isValidating}
                        className="w-full px-4 py-3 bg-primary-start text-white rounded-lg font-semibold hover:bg-primary-start/80 transition-colors disabled:opacity-50 flex items-center justify-center h-[51px] mt-4"
                    >
                        {isValidating ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : 'Save & Continue'}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/10 text-center">
                    <button 
                        onClick={handleSkip}
                        className="text-sm text-gray-400 hover:text-white flex items-center justify-center gap-2 mx-auto transition-colors"
                    >
                        Skip for now (Use Instant Mode)
                        <ArrowRightIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="mt-4 flex justify-center gap-4 text-xs text-gray-500">
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">Get Gemini Key</a>
                    <span>•</span>
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">Get OpenRouter Key</a>
                </div>
            </motion.div>
        </div>
    );
};
