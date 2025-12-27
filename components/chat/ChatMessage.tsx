
import React, { useState } from 'react';
import { Message, EmotionData } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { CodeBlock } from '../ui/CodeBlock';
import { 
    CheckCircleIcon, LightBulbIcon, CodeBracketSquareIcon, ShareIcon as ShareIconSolid, SparklesIcon, HandThumbUpIcon as HandThumbUpSolid, HandThumbDownIcon as HandThumbDownSolid, EyeIcon, SpeakerWaveIcon, PauseIcon, FaceSmileIcon 
} from '@heroicons/react/24/solid';
import { 
    ChevronDownIcon, ClipboardDocumentCheckIcon, HandThumbUpIcon, HandThumbDownIcon, ArrowPathIcon, EllipsisHorizontalIcon, GlobeAltIcon, ArrowUpOnSquareIcon, BoltIcon, DocumentIcon, DocumentTextIcon, CommandLineIcon, MagnifyingGlassIcon, XMarkIcon
} from '@heroicons/react/24/outline';
import { ClarificationForm } from './ClarificationForm';
import { MessageContent } from './MessageContent';
import { ImageModal } from '../modals/ImageModal';
import { MermaidDiagram } from './MermaidDiagram';
import { CanvasModal } from '../modals/CanvasModal';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useToast } from '../../hooks/useToast';
import { CanvasThinkingDisplay } from './CanvasThinkingDisplay';
import { SearchStatus } from './SearchStatus';
import { useAuth } from '../../contexts/AuthContext';
import { generateSpeech } from '../../services/geminiService';

const parseMessageContent = (content: string) => {
    if (!content) return { thinking: null, canvas: null, searches: [], clean: '' };
    
    // Improved THINK tag parsing to handle cases where it appears at start
    const thinkMatch = content.match(/<THINK>([\s\S]*?)(?:<\/THINK>|$)/i);
    const thinking = thinkMatch ? thinkMatch[1].trim() : null;
    
    // Extract ALL search tags
    const searchMatches = [...content.matchAll(/<SEARCH>([\s\S]*?)(?:<\/SEARCH>|$)/gi)];
    const searches = searchMatches.map(m => m[1].trim()).filter(Boolean);

    const canvasStart = content.search(/<CANVAS>/i);
    let canvas = null;
    if (canvasStart !== -1) {
        const afterStart = content.substring(canvasStart + 8); 
        const canvasEnd = afterStart.search(/<\/CANVAS>/i);
        if (canvasEnd !== -1) canvas = afterStart.substring(0, canvasEnd).trim();
        else canvas = afterStart.trim();
        if (canvas) canvas = canvas.replace(/^```\w*\n?/, '').replace(/```$/, '').trim();
    }
    
    // Cleanup regex - removes tags AND trims the result to ensure clean text
    let clean = content
        .replace(/<THINK>[\s\S]*?(?:<\/THINK>|$)/gi, '')
        .replace(/<CANVAS>[\s\S]*?(?:<\/CANVAS>|$)/gi, '')
        .replace(/<SEARCH>[\s\S]*?(?:<\/SEARCH>|$)/gi, '') // Remove search from main text
        .replace(/<MEMORY>[\s\S]*?<\/MEMORY>/gi, '')
        .replace(/<IMAGE>[\s\S]*?<\/IMAGE>/gi, '')
        .replace(/<PROJECT>[\s\S]*?<\/PROJECT>/gi, '')
        .replace(/<STUDY>[\s\S]*?<\/STUDY>/gi, '')
        .replace(/<DEEP>[\s\S]*?<\/DEEP>/gi, '')
        .replace(/<CANVAS_TRIGGER>[\s\S]*?<\/CANVAS_TRIGGER>/gi, '') // Also hide the trigger if present
        .trim();
        
    return { thinking, canvas, searches, clean };
};

const getModelDisplayName = (modelId?: string) => {
    if (!modelId) return "Bubble Auto";
    
    // Handle Instant Mode variations
    if (modelId.includes('Instant') || modelId.includes('Puter')) {
        // If the backend provided specific info like "Instant (Claude-3)"
        if (modelId.includes('(')) return modelId.replace('Instant', 'Puter'); 
        return "Puter (Auto)";
    }
    
    if (modelId.includes('gemini-2.5-flash')) return "Gemini 2.5 Flash";
    if (modelId.includes('gemini-3-pro')) return "Gemini 3 Pro";
    if (modelId.includes('gemini-1.5-pro')) return "Gemini 1.5 Pro";
    
    const parts = modelId.split('/');
    const name = parts.length > 1 ? parts[1] : modelId;
    return name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

async function decodePCM16(base64Data: string, ctx: AudioContext): Promise<AudioBuffer> {
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
    }
    const buffer = ctx.createBuffer(1, float32Data.length, 24000);
    buffer.copyToChannel(float32Data, 0);
    return buffer;
}

const EmotionViewer: React.FC<{ data: EmotionData; onClose: () => void }> = ({ data, onClose }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute z-30 w-64 p-4 bg-bg-secondary border border-border-color rounded-xl shadow-2xl"
            style={{ 
                bottom: '100%', 
                marginBottom: '8px',
                right: '0' 
            }}
        >
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FaceSmileIcon className="w-4 h-4 text-primary-start" />
                    Emotional State
                </h4>
                <button onClick={(e) => { e.stopPropagation(); onClose(); }}><XMarkIcon className="w-4 h-4 text-gray-500 hover:text-white" /></button>
            </div>
            
            <div className="mb-3 text-xs text-gray-400">
                Dominant: <span className="font-bold text-white">{data.dominant}</span>
            </div>

            <div className="space-y-2">
                {Object.entries(data.scores).map(([emotion, score]) => (
                    <div key={emotion} className="flex items-center gap-2 text-xs">
                        <span className="w-16 text-gray-400 truncate capitalize">{emotion}</span>
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${score}%` }}
                                className={`h-full rounded-full ${
                                    emotion === 'Anger' ? 'bg-red-500' :
                                    emotion === 'Joy' ? 'bg-yellow-400' :
                                    emotion === 'Sadness' ? 'bg-blue-400' :
                                    emotion === 'Fear' ? 'bg-purple-500' :
                                    emotion === 'Serious' ? 'bg-gray-500' :
                                    'bg-primary-start'
                                }`}
                            />
                        </div>
                        <span className="w-8 text-right text-gray-300">{score}%</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

interface ChatMessageProps {
  message: Message;
  onExecutePlan: (messageId: string) => void;
  onClarificationSubmit: (messageId: string, answers: string[]) => void;
  onRetry?: (messageId: string, modelOverride?: string) => void;
  isDimmed?: boolean;
  isCurrentResult?: boolean;
  searchQuery?: string;
  isAdmin?: boolean;
  isTyping?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
    message, onExecutePlan, onClarificationSubmit, onRetry, isDimmed = false, isCurrentResult = false, searchQuery = '', isAdmin = false, isTyping = false,
}) => {
  const { profile, geminiApiKey, isGuest } = useAuth();
  const { addToast } = useToast();
  const isUser = message.sender === 'user';
  const [showRaw, setShowRaw] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isCanvasPreviewOpen, setIsCanvasPreviewOpen] = useState(false);
  const [canvasCodeForPreview, setCanvasCodeForPreview] = useState('');
  const [feedback, setFeedback] = useState<'none' | 'like' | 'dislike'>('none');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isRegenMenuOpen, setIsRegenMenuOpen] = useState(false);
  const [isEmotionViewerOpen, setIsEmotionViewerOpen] = useState(false); // State for emotion viewer
  const { isCopied, copy } = useCopyToClipboard(message.text);
  
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioSource, setAudioSource] = useState<AudioBufferSourceNode | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  const { thinking, canvas, searches, clean } = isUser ? { thinking: null, canvas: null, searches: [], clean: message.text } : parseMessageContent(message.text);
  
  const isSearching = (searches.length > 0 && isTyping) && (!clean || clean.length < 5);

  const handleLike = (e: React.MouseEvent) => { e.stopPropagation(); setFeedback(prev => prev === 'like' ? 'none' : 'like'); addToast('Thanks for the feedback!', 'success'); };
  const handleDislike = (e: React.MouseEvent) => { e.stopPropagation(); setFeedback(prev => prev === 'dislike' ? 'none' : 'dislike'); addToast('Thanks for the feedback!', 'success'); };
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        if (navigator.share) await navigator.share({ title: 'Bubble AI Response', text: message.text });
        else { await navigator.clipboard.writeText(message.text); addToast('Response copied', 'success'); }
    } catch (err) { await navigator.clipboard.writeText(message.text); addToast('Response copied', 'success'); }
  };

  const cleanupAudio = () => {
      if (audioSource) {
          try { audioSource.stop(); } catch(e) {}
          setAudioSource(null);
      }
      if (audioContextRef.current) {
          audioContextRef.current.close().catch(console.error);
          audioContextRef.current = null;
      }
      setIsPlayingAudio(false);
      setIsGeneratingAudio(false);
  };

  const handlePlayAudio = async () => {
      if (isGuest) return; 

      if (isPlayingAudio) {
          cleanupAudio();
          return;
      }

      if (!geminiApiKey) {
          addToast("API Key needed for TTS", "error");
          return;
      }

      setIsGeneratingAudio(true);
      try {
          const speechText = clean.substring(0, 1000); 
          const base64Audio = await generateSpeech(speechText, geminiApiKey);
          
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          
          const audioBuffer = await decodePCM16(base64Audio, audioCtx);
          
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtx.destination);
          
          source.onended = () => {
              cleanupAudio();
          };
          
          setIsPlayingAudio(true);
          source.start(0);
          setAudioSource(source);
      } catch (e) {
          console.error("Audio playback error", e);
          addToast("Unable to play audio.", "error");
          cleanupAudio();
      } finally {
          setIsGeneratingAudio(false);
      }
  };
  
  React.useEffect(() => {
      return () => {
          if (audioContextRef.current) {
              audioContextRef.current.close().catch(console.error);
          }
      };
  }, []);

  const handleManualPreview = (code: string) => {
      setCanvasCodeForPreview(code);
      setIsCanvasPreviewOpen(true);
  };

  const variants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  const availableModels = [
      { id: 'gemini_2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini_3_pro_preview', name: 'Gemini 3 Pro' },
      ...(profile?.enabled_openrouter_models || []).map(m => ({ id: m, name: m.split('/')[1] || m }))
  ];

  if (isUser) {
    let attachments: any[] = [];
    if (message.image_base64) {
        try { 
            const parsed = JSON.parse(message.image_base64); 
            if (Array.isArray(parsed)) {
                const validParsed = parsed.filter(item => item !== null && item !== undefined);
                if (validParsed.length > 0) {
                    if (typeof validParsed[0] === 'string') {
                        attachments = validParsed.map((b64, i) => ({ type: 'image/jpeg', data: b64, name: `Image ${i+1}` }));
                    } else {
                        attachments = validParsed;
                    }
                }
            } else if (parsed && typeof parsed === 'object') {
                attachments = [parsed];
            } else {
                attachments = [{ type: 'image/jpeg', data: message.image_base64, name: 'Attachment' }];
            }
        } catch { 
            attachments = [{ type: 'image/jpeg', data: message.image_base64, name: 'Attachment' }]; 
        }
    }

    return (
        <motion.div variants={variants} initial="hidden" animate="visible" className={`flex justify-end mb-3 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}>
            <div className={`bg-zinc-800 text-zinc-100 rounded-2xl px-4 py-3 max-w-[90%] md:max-w-[75%] break-words shadow-md relative group ${isCurrentResult ? 'ring-2 ring-yellow-400' : ''}`}>
                
                {/* User Message Action Menu Trigger */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsMoreOpen(!isMoreOpen); }} 
                            className="p-1 text-gray-400 hover:text-white bg-black/20 rounded-full"
                        >
                            <EllipsisHorizontalIcon className="w-4 h-4" />
                        </button>
                        {isMoreOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsMoreOpen(false)} />
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }} 
                                    animate={{ opacity: 1, scale: 1 }} 
                                    className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-color rounded-lg shadow-xl z-20 w-40 overflow-hidden"
                                >
                                    {message.emotionData ? (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setIsEmotionViewerOpen(true); setIsMoreOpen(false); }} 
                                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"
                                        >
                                            <FaceSmileIcon className="w-3.5 h-3.5" /> View Emotion
                                        </button>
                                    ) : (
                                        <div className="px-3 py-2 text-xs text-gray-500 italic">No emotion data</div>
                                    )}
                                </motion.div>
                            </>
                        )}
                        {isEmotionViewerOpen && message.emotionData && (
                            <>
                                <div className="fixed inset-0 z-20" onClick={() => setIsEmotionViewerOpen(false)} />
                                <EmotionViewer data={message.emotionData} onClose={() => setIsEmotionViewerOpen(false)} />
                            </>
                        )}
                    </div>
                </div>

                {attachments.length > 0 && (
                    <div className={`grid gap-2 mb-2 ${attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {attachments.map((att, index) => {
                            if (!att) return null; 
                            const isImage = att.type && att.type.startsWith('image/');
                            return (
                                <div key={index} className="overflow-hidden rounded-lg border border-white/10 bg-black/20 group relative">
                                    {isImage && att.data ? (
                                        <img src={`data:${att.type};base64,${att.data}`} alt={att.name || "Upload"} className="w-full h-auto object-cover max-h-48" />
                                    ) : (
                                        <div className="flex items-center gap-3 p-3 transition-colors hover:bg-white/5">
                                            <div className="p-2 rounded-lg bg-gray-500/20"><DocumentIcon className="w-6 h-6 text-gray-400" /></div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate text-white" title={att.name}>{att.name}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="text-base md:text-sm leading-relaxed">
                    <MessageContent content={message.text} searchQuery={searchQuery} sender={message.sender} />
                </div>
            </div>
        </motion.div>
    );
  }
  
  return (
    <motion.div variants={variants} initial="hidden" animate="visible" className={`flex items-start gap-4 transition-opacity duration-300 ${isDimmed ? 'opacity-30' : 'opacity-100'} max-w-full group`}>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center border border-border-color shadow-sm mt-1">
            {isTyping ? (
                <div className="relative flex items-center justify-center w-full h-full">
                    <svg className="animate-spin h-6 w-6 text-primary-start absolute" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <div className="w-2 h-2 bg-primary-start rounded-full animate-pulse"></div>
                </div>
            ) : (
                <span className="text-lg">🫧</span>
            )}
        </div>
        <div className={`flex-1 min-w-0 ${isCurrentResult ? 'rounded-lg ring-2 ring-yellow-400 p-2' : ''}`}>
            
            {(thinking !== null) && (
                 <CanvasThinkingDisplay thinking={thinking || ''} isTyping={isTyping && !thinking && !isSearching} />
            )}

            {isSearching && (
                <div className="mb-3">
                    <div className="flex items-center gap-3 px-3 py-2 bg-bg-secondary/50 rounded-lg border border-primary-start/20 w-fit">
                        <div className="relative flex items-center justify-center w-4 h-4">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-primary-start/30 animate-ping"></span>
                            <MagnifyingGlassIcon className="w-3.5 h-3.5 text-primary-start relative z-10" />
                        </div>
                        <span className="text-xs text-text-secondary font-medium">Searching online...</span>
                    </div>
                </div>
            )}

            <div className="w-full mt-1 max-w-full text-base md:text-sm leading-relaxed text-text-primary">
                {showRaw ? <pre className="p-4 text-xs bg-bg-tertiary rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">{JSON.stringify(message, null, 2)}</pre> : (
                    <>
                        {message.standing_response ? (
                            <MessageContent content={message.text} searchQuery={searchQuery || ''} sender={message.sender} isTyping={isTyping} />
                        ) : message.plan ? (
                             <MessageContent content={message.text} searchQuery={searchQuery || ''} sender={message.sender} isTyping={isTyping} />
                        ) : message.clarification ? (
                             <MessageContent content={message.text} searchQuery={searchQuery || ''} sender={message.sender} isTyping={isTyping} />
                        ) : (
                            <MessageContent content={clean} searchQuery={searchQuery} sender={message.sender} isTyping={isTyping} onPreviewHtml={handleManualPreview} />
                        )}

                        {canvas && (
                            <div className="my-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-primary-start uppercase tracking-wider">Canvas</span>
                                    <div className="h-px bg-border-color flex-1"></div>
                                </div>
                                <CodeBlock 
                                    code={canvas} 
                                    language="html" 
                                    onPreview={() => {
                                        setCanvasCodeForPreview(canvas || '');
                                        setIsCanvasPreviewOpen(true);
                                    }} 
                                />
                            </div>
                        )}
                        
                        {message.image_base64 && (
                            <>
                                <div className="mt-4 not-prose">
                                    <button onClick={() => setIsImageModalOpen(true)} className="block w-full group"><img src={`data:image/png;base64,${message.image_base64}`} alt="Generated content" className="rounded-lg max-w-md mx-auto h-auto shadow-lg transition-transform duration-200 group-hover:scale-[1.02]" /></button>
                                </div>
                                <AnimatePresence>{isImageModalOpen && <ImageModal src={`data:image/png;base64,${message.image_base64}`} onClose={() => setIsImageModalOpen(false)} />}</AnimatePresence>
                            </>
                        )}
                        {message.code && !clean.includes('```') && <div className="not-prose max-w-full overflow-hidden mt-4"><CodeBlock code={message.code} language={message.language || 'lua'} /></div>}
                    </>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 select-none not-prose relative transition-opacity duration-200 opacity-100 md:opacity-50 md:group-hover:opacity-100">
                
                <SearchStatus 
                    isSearching={false} 
                    query={null}
                    sources={message.groundingMetadata} 
                />

                <button onClick={(e) => { e.stopPropagation(); copy(); }} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-interactive-hover rounded-md" title="Copy"><ClipboardDocumentCheckIcon className="w-4 h-4" /></button>
                <button onClick={handleLike} className={`p-1.5 rounded-md ${feedback === 'like' ? 'text-green-400' : 'text-text-secondary hover:text-text-primary'}`}><HandThumbUpIcon className="w-4 h-4" /></button>
                <button onClick={handleDislike} className={`p-1.5 rounded-md ${feedback === 'dislike' ? 'text-red-400' : 'text-text-secondary hover:text-text-primary'}`}><HandThumbDownIcon className="w-4 h-4" /></button>
                
                {!isGuest && (
                    <>
                        <button onClick={handleShare} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-interactive-hover rounded-md"><ArrowUpOnSquareIcon className="w-4 h-4" /></button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handlePlayAudio(); }} 
                            className={`p-1.5 rounded-md transition-colors ${isPlayingAudio ? 'text-primary-start bg-primary-start/10' : 'text-text-secondary hover:text-text-primary hover:bg-bg-interactive-hover'}`}
                            title={isPlayingAudio ? "Stop" : "Listen"}
                            disabled={isGeneratingAudio}
                        >
                            {isGeneratingAudio ? (
                                <svg className="animate-spin h-4 w-4 text-primary-start" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : isPlayingAudio ? (
                                <PauseIcon className="w-4 h-4" />
                            ) : (
                                <SpeakerWaveIcon className="w-4 h-4" />
                            )}
                        </button>

                        {onRetry && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRetry(message.id); }} 
                                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-interactive-hover rounded-md"
                                title="Regenerate"
                            >
                                <ArrowPathIcon className="w-4 h-4" />
                            </button>
                        )}
                        
                        <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setIsMoreOpen(!isMoreOpen); }} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-interactive-hover rounded-md"><EllipsisHorizontalIcon className="w-4 h-4" /></button>
                            <AnimatePresence>
                                {isMoreOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => { setIsMoreOpen(false); setIsRegenMenuOpen(false); setIsEmotionViewerOpen(false); }} />
                                        <motion.div 
                                            initial={{ opacity: 0, y: 5, scale: 0.95 }} 
                                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                                            exit={{ opacity: 0, y: 5, scale: 0.95 }} 
                                            className="absolute left-0 bottom-full mb-2 bg-bg-tertiary border border-border-color rounded-lg shadow-xl z-20 w-48 overflow-hidden"
                                        >
                                            <div className="px-3 py-2 border-b border-border-color bg-bg-secondary">
                                                <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider mb-1">Generated By</p>
                                                <div className="flex items-center gap-1.5 text-xs text-text-primary">
                                                    <SparklesIcon className="w-3 h-3 text-primary-start" />
                                                    <span className="truncate">{getModelDisplayName(message.model)}</span>
                                                </div>
                                            </div>

                                            {onRetry && (
                                                <div className="relative">
                                                    <button 
                                                        onClick={() => setIsRegenMenuOpen(!isRegenMenuOpen)} 
                                                        className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-interactive-hover flex items-center justify-between"
                                                    >
                                                        <span className="flex items-center gap-2"><BoltIcon className="w-4 h-4"/> Regenerate with...</span>
                                                        <ChevronDownIcon className="w-3 h-3" />
                                                    </button>
                                                    {isRegenMenuOpen && (
                                                        <div className="bg-bg-primary/50 border-t border-border-color">
                                                            {availableModels.map(model => (
                                                                <button
                                                                    key={model.id}
                                                                    onClick={() => { onRetry(message.id, model.id); setIsMoreOpen(false); }}
                                                                    className="w-full text-left px-6 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-interactive-hover truncate"
                                                                >
                                                                    {model.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <button onClick={() => { setShowRaw(!showRaw); setIsMoreOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-interactive-hover flex items-center gap-2"><EyeIcon className="w-4 h-4" /> {showRaw ? "Hide Raw Data" : "View Raw Data"}</button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </div>
        </div>
        <AnimatePresence>{isCanvasPreviewOpen && <CanvasModal code={canvasCodeForPreview} onClose={() => setIsCanvasPreviewOpen(false)} />}</AnimatePresence>
    </motion.div>
  );
};
