
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobeAltIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SearchStatusProps {
    isSearching: boolean;
    query?: string | string[] | null;
    sources?: Array<{ web?: { uri?: string; title?: string }; uri?: string; title?: string; url?: string }>;
}

const getFaviconUrl = (url?: string) => {
    if (!url) return '';
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
        return '';
    }
};

const getDomain = (url?: string) => {
    if (!url) return 'Unknown Source';
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return url;
    }
};

export const SearchStatus: React.FC<SearchStatusProps> = ({ sources, query, isSearching }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Normalize sources to handle different structures ({ web: { uri } } vs { uri } vs { url })
    const normalizedSources = (sources || []).map(s => {
        const uri = s.web?.uri || s.uri || s.url || '';
        const title = s.web?.title || s.title || "Web Result";
        return { uri, title };
    }).filter(s => s.uri); // Filter out empty URIs

    // Deduplicate
    const uniqueSources = normalizedSources.filter((v, i, a) => 
        a.findIndex(t => t.uri === v.uri) === i
    );

    if (uniqueSources.length === 0 && !isSearching) return null;
    
    return (
        <div className="relative inline-block">
            <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
                title="View Sources"
            >
                <GlobeAltIcon className={`w-4 h-4 ${isSearching ? 'text-yellow-400 animate-pulse' : 'text-primary-start'}`} />
                <span>
                    {isSearching ? 'Searching...' : `${uniqueSources.length} ${uniqueSources.length === 1 ? 'Source' : 'Sources'}`}
                </span>
            </button>

            <AnimatePresence>
                {isExpanded && uniqueSources.length > 0 && (
                    <>
                        <div className="fixed inset-0 z-20" onClick={() => setIsExpanded(false)} />
                        <motion.div 
                            initial={{ opacity: 0, y: 5, scale: 0.95 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, y: 5, scale: 0.95 }}
                            className="absolute left-0 bottom-full mb-2 w-72 bg-bg-tertiary border border-border-color rounded-lg shadow-xl z-30 p-2 overflow-hidden"
                        >
                            <div className="flex items-center justify-between px-2 pb-2 border-b border-white/5 mb-1">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Citations</span>
                                <button onClick={() => setIsExpanded(false)}><XMarkIcon className="w-4 h-4 text-gray-500 hover:text-white"/></button>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                                {uniqueSources.map((source, idx) => (
                                    <a
                                        key={idx}
                                        href={source.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-md group transition-colors"
                                    >
                                        <img 
                                            src={getFaviconUrl(source.uri)} 
                                            alt="" 
                                            className="w-4 h-4 rounded-sm opacity-70 group-hover:opacity-100 flex-shrink-0"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-gray-200 truncate font-medium">{source.title}</p>
                                            <p className="text-[10px] text-gray-500 truncate">{getDomain(source.uri)}</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
