
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, LightBulbIcon } from '@heroicons/react/24/outline';

interface CanvasThinkingDisplayProps {
    thinking: string;
    isTyping?: boolean;
}

export const CanvasThinkingDisplay: React.FC<CanvasThinkingDisplayProps> = ({ thinking, isTyping }) => {
    // Auto-open if typing to show the user the AI is working
    const [isOpen, setIsOpen] = useState(false);
    const isBuffering = thinking === '';

    useEffect(() => {
        if (isTyping) {
            setIsOpen(true);
        }
    }, [isTyping]);

    return (
        <div className="mb-3 max-w-2xl">
             <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full md:w-auto border ${isOpen ? 'bg-bg-tertiary border-border-color text-text-primary' : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'}`}
                title="View reasoning process"
            >
                <div className={`flex items-center justify-center w-4 h-4 ${isTyping ? 'animate-pulse text-primary-start' : 'text-text-secondary'}`}>
                    <LightBulbIcon className="w-4 h-4" />
                </div>
                
                <span className="flex-1 text-left">
                    {isTyping ? 'Thinking Process...' : 'Reasoning'}
                </span>
                
                <ChevronDownIcon className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }} 
                        className="overflow-hidden"
                    >
                        <div className="mt-2 text-xs text-text-secondary font-mono whitespace-pre-wrap leading-relaxed bg-bg-tertiary border-l-2 border-primary-start/50 pl-4 py-3 pr-4 rounded-r-lg">
                            {isBuffering ? (
                                <div className="flex items-center gap-2 text-text-secondary italic">
                                    <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce delay-100"></span>
                                    <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce delay-200"></span>
                                    <span>Formulating thoughts...</span>
                                </div>
                            ) : thinking}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
