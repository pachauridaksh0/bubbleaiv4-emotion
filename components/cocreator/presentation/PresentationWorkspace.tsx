
import React, { useMemo, useState, useEffect } from 'react';
import Split from 'react-split-grid';
import { IdeWorkspaceProps } from '../shared/IdeWorkspace';
import { ChatView } from '../../chat/ChatView';
import { useWindowSize } from '../../../hooks/useWindowSize';
import { ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon, PhotoIcon } from '@heroicons/react/24/solid';

// Enhanced markdown-to-html for presentation slides with better typography
const renderSlideContent = (markdown: string) => {
    let html = markdown
        // Title
        .replace(/^# (.*$)/gim, '<h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 text-center text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400 drop-shadow-sm leading-tight">$1</h1>')
        // Subtitle
        .replace(/^## (.*$)/gim, '<h2 class="text-xl md:text-2xl font-medium mb-8 text-primary-start text-center uppercase tracking-widest opacity-90">$1</h2>')
        // List items with custom bullets
        .replace(/^\* (.*$)/gim, '<div class="flex items-start gap-4 mb-4 slide-item"><span class="text-primary-start text-2xl mt-[-2px]">•</span><span class="text-xl text-gray-200 leading-relaxed">$1</span></div>')
        .replace(/^- (.*$)/gim, '<div class="flex items-start gap-4 mb-4 slide-item"><span class="text-primary-start text-2xl mt-[-2px]">•</span><span class="text-xl text-gray-200 leading-relaxed">$1</span></div>')
        // Numbered lists
        .replace(/^\d+\. (.*$)/gim, '<div class="flex items-start gap-4 mb-4 slide-item"><span class="text-primary-start text-xl font-bold bg-primary-start/10 px-2 rounded">#</span><span class="text-xl text-gray-200 leading-relaxed">$1</span></div>')
        // Bold/Italic
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold text-shadow-sm">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-gray-300 italic font-serif">$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="bg-white/10 text-blue-300 px-2 py-0.5 rounded font-mono text-lg border border-white/5">$1</code>')
        // Tables
        .replace(/\|(.+)\|/g, (match) => {
            // Basic table row parsing
            const cells = match.split('|').filter(c => c.trim() !== '');
            const isHeader = match.includes('---');
            if (isHeader) return ''; // Skip separator lines in simple regex replacement
            return `<div class="grid grid-flow-col gap-4 mb-2 p-2 bg-white/5 rounded border border-white/10">${cells.map(c => `<div>${c.trim()}</div>`).join('')}</div>`;
        })
        // Visual Placeholders [Visual: description]
        .replace(/\[Visual: (.*?)\]/gim, `
            <div class="my-6 p-6 bg-gradient-to-br from-gray-800 to-black rounded-xl border border-white/10 flex flex-col items-center justify-center text-center group hover:border-primary-start/50 transition-colors">
                <div class="mb-3 p-3 bg-white/5 rounded-full text-gray-400 group-hover:text-primary-start group-hover:bg-primary-start/10 transition-colors">
                    <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <span class="text-sm font-medium text-gray-300 italic">Visual Suggestion</span>
                <span class="text-xs text-gray-500 mt-1 max-w-sm">$1</span>
            </div>
        `)
        // Speaker notes handled by container extraction, here just hide from view if leaked
        .replace(/^Speaker Notes:.*$/gim, '') 
        .replace(/\n/g, '<br />');

    return { __html: html };
};

export const PresentationWorkspace: React.FC<IdeWorkspaceProps> = (props) => {
    const { messages, isLoadingHistory } = props;
    const { width } = useWindowSize();
    const isMobile = width ? width < 1024 : false;
    const [selectedSlide, setSelectedSlide] = useState(0);

    const slides = useMemo(() => {
        const latestCodeMessage = [...messages].reverse().find(m => m.sender === 'ai' && (m.code || m.text.includes('---')));
        
        if (!latestCodeMessage) return [];
        
        const content = latestCodeMessage.code || latestCodeMessage.text;
        const rawSlides = content.split(/^---$/m).map(s => s.trim()).filter(Boolean);
        
        return rawSlides;
    }, [messages]);
    
    useEffect(() => {
        if (slides.length > 0 && selectedSlide >= slides.length) {
            setSelectedSlide(0);
        }
    }, [slides.length, selectedSlide]);

    useEffect(() => {
        if (isLoadingHistory && slides.length > 0) {
            setSelectedSlide(slides.length - 1);
        }
    }, [slides.length, isLoadingHistory]);

    const nextSlide = () => setSelectedSlide(prev => Math.min(prev + 1, slides.length - 1));
    const prevSlide = () => setSelectedSlide(prev => Math.max(prev - 1, 0));
    
    const slideView = (
        <div className="h-full overflow-hidden flex flex-col md:flex-row bg-bg-primary">
            {slides.length > 0 ? (
                <>
                    {/* Thumbnail Sidebar */}
                    <div className="w-full md:w-64 flex-shrink-0 bg-bg-secondary p-4 overflow-x-auto md:overflow-y-auto border-b md:border-b-0 md:border-r border-border-color flex md:flex-col gap-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 hidden md:block">Slides ({slides.length})</h3>
                        {slides.map((slide, index) => (
                            <div
                                key={index}
                                onClick={() => setSelectedSlide(index)}
                                className={`
                                    flex-shrink-0 w-40 md:w-full aspect-video p-1 rounded-lg cursor-pointer bg-white relative overflow-hidden transition-all duration-200 group
                                    ${selectedSlide === index ? 'ring-2 ring-primary-start shadow-lg scale-105 z-10' : 'ring-1 ring-white/10 opacity-70 hover:opacity-100 hover:scale-102'}
                                `}
                            >
                                <div className="absolute top-2 left-2 z-20 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                                    {index + 1}
                                </div>

                                {isLoadingHistory && index === slides.length - 1 && (
                                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                                        <div className="flex flex-col items-center gap-2">
                                            <svg className="animate-spin h-6 w-6 text-primary-start" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            <span className="text-[10px] text-white font-bold uppercase tracking-widest">Generating...</span>
                                        </div>
                                    </div>
                                )}

                                <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black rounded overflow-hidden relative">
                                    <div 
                                        className="origin-top-left transform scale-[0.25] w-[400%] h-[400%] p-8 flex flex-col items-center justify-center text-center pointer-events-none"
                                        dangerouslySetInnerHTML={renderSlideContent(slide)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Main Slide View */}
                    <div className="flex-1 relative flex flex-col items-center justify-center bg-[#121212] p-4 md:p-12 overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800/20 via-transparent to-transparent">
                        
                        <div className="w-full max-w-6xl aspect-video bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-xl shadow-2xl border border-white/5 flex flex-col relative overflow-hidden ring-1 ring-white/10">
                            
                            {/* Decorative Background Blobs */}
                            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary-start/5 rounded-full blur-[100px] pointer-events-none"></div>
                            <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[60%] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>

                            <div className="flex-1 p-12 md:p-20 flex flex-col justify-center items-center relative z-10 overflow-y-auto custom-scrollbar">
                                <div 
                                    className="w-full max-w-5xl text-left slide-content"
                                    dangerouslySetInnerHTML={renderSlideContent(slides[selectedSlide] || '')}
                                />
                            </div>
                            
                            <div className="h-12 border-t border-white/5 bg-black/30 backdrop-blur-md flex items-center justify-between px-8 text-xs text-gray-500 uppercase tracking-widest font-semibold">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary-start"></div> Bubble Presentation</span>
                                <span>{selectedSlide + 1} / {slides.length}</span>
                            </div>
                        </div>

                        <div className="absolute bottom-6 flex items-center gap-6 bg-black/60 backdrop-blur-xl p-2 px-6 rounded-full border border-white/10 shadow-xl transition-transform hover:scale-105 z-20">
                            <button 
                                onClick={prevSlide} 
                                disabled={selectedSlide === 0}
                                className="p-2 hover:bg-white/10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white group"
                            >
                                <ChevronLeftIcon className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                            <span className="text-sm font-bold text-gray-200 min-w-[80px] text-center">
                                Slide {selectedSlide + 1}
                            </span>
                            <button 
                                onClick={nextSlide} 
                                disabled={selectedSlide === slides.length - 1}
                                className="p-2 hover:bg-white/10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white group"
                            >
                                <ChevronRightIcon className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>

                    </div>
                </>
            ) : (
                <div className="flex items-center justify-center h-full w-full text-gray-500 text-center p-8 bg-bg-primary">
                    <div className="max-w-md">
                        <div className="w-20 h-20 bg-bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                            <ArrowDownTrayIcon className="w-10 h-10 text-gray-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Presentation Builder</h3>
                        <p className="text-gray-400 mb-8">Ask the AI to generate slides to see them here. You can request specific topics, outlines, or full decks.</p>
                        <div className="bg-white/5 rounded-lg p-4 text-left border border-white/10">
                            <p className="text-xs text-gray-500 uppercase font-bold mb-2">Try asking:</p>
                            <p className="text-sm text-primary-start font-mono">"Create a 5-slide pitch deck for a futuristic coffee shop"</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
    
    if (isMobile) {
        return <ChatView {...props} />;
    }

    return (
        <div className="h-full w-full bg-transparent text-white">
            <Split gridTemplateColumns="minmax(350px, 1fr) 8px 2fr" minSize={300} cursor="col-resize">
                {(split: any) => (
                     <div className="grid h-full w-full bg-bg-primary" {...split.getGridProps()}>
                        <div className="h-full bg-bg-secondary overflow-hidden border-r border-border-color">
                            <ChatView {...props} />
                        </div>
                        <div className="h-full bg-bg-tertiary cursor-col-resize hover:bg-primary-start/50 transition-colors" {...split.getGutterProps('column', 1)} />
                        <div className="h-full overflow-hidden">
                           {slideView}
                        </div>
                    </div>
                )}
            </Split>
        </div>
    );
};
