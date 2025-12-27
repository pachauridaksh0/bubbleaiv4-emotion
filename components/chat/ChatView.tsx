
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Project, Chat, WorkspaceMode, ChatWithProjectData } from '../../types';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { InitialPromptView } from './InitialPromptView';
import { LinkIcon, CodeBracketIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { ProgressIndicator } from '../features/ProgressIndicator';
import AuroraCanvas from '../ui/AuroraCanvas';
import { CanvasThinkingDisplay } from './CanvasThinkingDisplay';
import { LiveSessionOverlay } from './LiveSessionOverlay';
import { useChat } from '../../hooks/useChat';

interface ChatViewProps {
  project: Project | null;
  chat: ChatWithProjectData | null;
  geminiApiKey: string;
  messages: Message[];
  isLoadingHistory: boolean;
  isSending: boolean;
  isCreatingChat: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onSendMessage: (text: string, files?: File[] | null, chat?: ChatWithProjectData | null, modelOverride?: string) => void;
  onChatUpdate: ((updates: Partial<Chat>) => void) | null;
  onActiveProjectUpdate: ((updates: Partial<Project>) => Promise<void>) | null;
  searchQuery: string;
  onSearchResultsChange: (indices: number[]) => void;
  currentSearchResultMessageIndex: number;
  isAdmin: boolean;
  workspaceMode: WorkspaceMode;
  loadingMessage: string;
  onStop?: () => void;
  onStopGeneration?: () => void;
  onRequireAuth?: () => void;
}

const contextualPromptsData: Record<string, { text: string; icon?: React.ReactElement }[]> = {
    study: [
        { text: "Help me with my homework", icon: <LinkIcon className="w-5 h-5" /> },
        { text: "Explain a topic to me", icon: <PencilSquareIcon className="w-5 h-5" /> },
        { text: "Create a practice quiz", icon: <CodeBracketIcon className="w-5 h-5" /> },
    ],
    image: [
        { text: "Create an image of a magazine cover of cute animals with headlines and text" },
        { text: "Create an image for a garden-themed birthday party invitation" },
        { text: "Create an image of an astronaut with an inflatable duck on Mars" },
        { text: "Create an image of a tutorial for cooking pasta" },
    ],
    think: [
        { text: "Help me brainstorm ideas for a new Roblox game" },
        { text: "What are some creative ways to use AI in education?" },
        { text: "Let's think about the future of transportation." },
    ],
    research: [
        { text: "What are the latest advancements in AI?" },
        { text: "Give me a detailed report on the history of video games." },
        { text: "Compare the pros and cons of React vs. Vue." },
    ],
    search: [
        { text: "What's the weather like in New York?" },
        { text: "Who won the last F1 race?" },
        { text: "Find the recipe for chocolate chip cookies." },
    ],
};

const rotatingTitles = [
    "What's on the agenda today?",
    "What shall we create together?",
    "Ready to bring your ideas to life?",
    "How can I help you build today?",
    "Let's architect something amazing.",
    "What problem are we solving today?"
];

const ContextualPrompts: React.FC<{ action: string; onPromptClick: (prompt: string) => void; }> = ({ action, onPromptClick }) => {
    const prompts = contextualPromptsData[action as keyof typeof contextualPromptsData] || [];
    if (prompts.length === 0) return null;
    return (
        <motion.div {...{initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: 0.1 }}} className="w-full">
            <div className="space-y-2">
                {prompts.map((prompt, index) => (
                    <button key={index} onClick={() => onPromptClick(prompt.text)} className="w-full text-left p-3 bg-zinc-800/50 border border-zinc-700/80 rounded-xl hover:bg-zinc-700/70 transition-colors flex items-center gap-3">
                        {prompt.icon && <span className="text-zinc-400">{prompt.icon}</span>}
                        <span className="text-zinc-300 text-sm">{prompt.text}</span>
                    </button>
                ))}
            </div>
        </motion.div>
    );
};

const AutonomousInitialViewTitle: React.FC<{ selectedAction: string, title?: string }> = ({ selectedAction, title }) => {
    const titleMap: Record<string, string> = { research: "What are you researching?", default: title || "What's on the agenda today?" };
    return (
        <motion.div key={selectedAction} {...{initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { type: 'spring', delay: 0.2, duration: 0.5 }}} className="w-full">
            <h2 className="text-2xl md:text-3xl font-medium text-text-primary mb-8 text-center px-4">{titleMap[selectedAction] || titleMap.default}</h2>
        </motion.div>
    );
};

export const ChatView: React.FC<ChatViewProps> = ({ 
    project, 
    chat,
    geminiApiKey,
    messages,
    isLoadingHistory,
    isSending,
    isCreatingChat,
    setMessages,
    onSendMessage,
    onChatUpdate,
    onActiveProjectUpdate,
    searchQuery,
    onSearchResultsChange,
    currentSearchResultMessageIndex,
    isAdmin,
    workspaceMode,
    loadingMessage,
    onStop,
    onStopGeneration,
    onRequireAuth
}) => {
  const { user } = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isInitialView = messages.length === 0 && !isLoadingHistory && !isCreatingChat;
  const [selectedAction, setSelectedAction] = useState('default');
  const [progress, setProgress] = useState<{ tasks: string[], current: number } | null>(null);
  
  const [showThinking, setShowThinking] = useState(false);
  const [randomTitle, setRandomTitle] = useState(rotatingTitles[0]);

  // Set random title on mount
  useEffect(() => {
      setRandomTitle(rotatingTitles[Math.floor(Math.random() * rotatingTitles.length)]);
  }, []);
  
  // FIX: Determine generation state strictly from explicit loading props (isSending/isCreatingChat).
  // Do NOT infer from message history (e.g. last message is user) as this causes stuck states on reload.
  const isGenerating = isCreatingChat || isSending;

  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);

  useEffect(() => {
      let timer: number;
      if (isGenerating) {
          setShowThinking(false);
          // Show "Thinking..." much sooner (2s instead of 7s) to reduce perceived hang time
          timer = window.setTimeout(() => { setShowThinking(true); }, 2000);
      } else { setShowThinking(false); }
      return () => clearTimeout(timer);
  }, [isGenerating]);

  useEffect(() => {
    // Clear progress and thinking if we are definitely done
    if (!isGenerating) { setProgress(null); setShowThinking(false); }
  }, [isGenerating]);

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);
  useEffect(() => { if (searchQuery.trim() === '') { scrollToBottom(); } }, [messages, searchQuery, scrollToBottom, showThinking]);

  useEffect(() => {
    if (searchQuery.trim() === '') { onSearchResultsChange([]); return; }
    const results = messages.map((msg, index) => (msg.text.toLowerCase().includes(searchQuery.toLowerCase()) ? index : -1)).filter(index => index !== -1);
    onSearchResultsChange(results);
  }, [searchQuery, messages, onSearchResultsChange]);

  useEffect(() => {
    if (currentSearchResultMessageIndex !== -1 && messageRefs.current[currentSearchResultMessageIndex]) {
      messageRefs.current[currentSearchResultMessageIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSearchResultMessageIndex]);
  
  const handleExecutePlan = async (messageId: string) => {};
  const handleClarificationSubmit = async (messageId: string, answers: string[]) => {}
  const handleRetry = async (messageId: string, modelOverride?: string) => {
      const msgIndex = messages.findIndex(m => m.id === messageId);
      if (msgIndex === -1) return;
      const msg = messages[msgIndex];
      if (msg.sender !== 'ai') return;
      const prevMsg = messages[msgIndex - 1];
      if (prevMsg && prevMsg.sender === 'user') {
          const newHistory = messages.slice(0, msgIndex);
          setMessages(newHistory);
          onSendMessage(prevMsg.text, null, null, modelOverride);
      }
  };

  const handleCloseLiveSession = useCallback(() => { setIsLiveSessionOpen(false); }, []);

  const chatInputComponent = (
    <ChatInput
      onSendMessage={(text, files, modelOverride) => { setProgress(null); onSendMessage(text, files, chat, modelOverride) }}
      onStop={onStop || onStopGeneration}
      isLoading={isGenerating || !!progress} // Passing the strict isGenerating based on isSending ensures Stop button appears correctly
      chat={chat}
      onChatUpdate={onChatUpdate}
      isAdmin={isAdmin}
      workspaceMode={workspaceMode}
      isInitialView={isInitialView && !chat}
      loadingMessage={loadingMessage}
      project={project}
      selectedAction={selectedAction}
      onActionSelect={setSelectedAction}
      onStartLive={() => setIsLiveSessionOpen(true)}
      onRequireAuth={onRequireAuth}
    />
  );
  
  return (
    <div className="flex flex-col h-full relative bg-transparent overflow-hidden">
        {workspaceMode === 'autonomous' && (
            <>
                <div className="absolute inset-0 z-0"><AuroraCanvas /></div>
                {/* Increased base opacity to 0.7 for better text contrast against the aurora */}
                <div className="absolute inset-0 z-0 bg-bg-primary transition-opacity duration-[800ms] ease-in-out pointer-events-none" style={{ opacity: messages.length > 0 ? 0.7 : 0 }} />
            </>
        )}

        <AnimatePresence>
            {isLiveSessionOpen && (
                <LiveSessionOverlay apiKey={geminiApiKey} onClose={handleCloseLiveSession} chatId={chat?.id} project={project} />
            )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col h-full w-full">
            {isInitialView && workspaceMode === 'autonomous' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
                    <AutonomousInitialViewTitle selectedAction={selectedAction} title={randomTitle} />
                    <div className="w-full max-w-4xl">{chatInputComponent}</div>
                    <div className="w-full max-w-4xl mt-4"><ContextualPrompts action={selectedAction} onPromptClick={(prompt) => onSendMessage(prompt)} /></div>
                </div>
            ) : (
                <>
                    <div className={`flex-1 overflow-y-auto flex flex-col p-4`}>
                        <div className="w-full max-w-4xl flex-1 mx-auto">
                            {isLoadingHistory && messages.length === 0 && (
                                <div className="flex items-center justify-center h-full"><svg className="animate-spin h-8 w-8 text-primary-start" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
                            )}
                            
                            {chat && isInitialView && workspaceMode === 'cocreator' && (
                                <InitialPromptView onSendMessage={(prompt) => onSendMessage(prompt)} projectType={project?.project_type} />
                            )}
                            
                            {!isInitialView && (
                                <div className="space-y-6">
                                    <AnimatePresence initial={false}>
                                      {messages.map((msg, index) => {
                                        const isLastMessage = index === messages.length - 1;
                                        // Only show typing indicator if we are strictly generating AND it's the last message
                                        const isAiTyping = isLastMessage && isGenerating && msg.sender === 'ai';
                                        return (
                                            <div key={msg.id} ref={el => { messageRefs.current[index] = el; }}>
                                                <ChatMessage message={msg} onExecutePlan={handleExecutePlan} onClarificationSubmit={handleClarificationSubmit} onRetry={handleRetry} isDimmed={searchQuery.trim() !== '' && !msg.text.toLowerCase().includes(searchQuery.toLowerCase())} isCurrentResult={index === currentSearchResultMessageIndex} searchQuery={searchQuery} isAdmin={isAdmin} isTyping={isAiTyping} />
                                            </div>
                                        )
                                      })}
                                    </AnimatePresence>
                                    
                                    <AnimatePresence>
                                        {/* Thinking Indicator for Co-Creator */}
                                        {showThinking && workspaceMode === 'cocreator' && (
                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full">
                                                <CanvasThinkingDisplay thinking="" isTyping={true} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="w-full max-w-4xl mx-auto px-4 pb-4">{chatInputComponent}</div>
                </>
            )}
        </div>

        <AnimatePresence>
            {progress && <ProgressIndicator tasks={progress.tasks} currentTask={progress.current} />}
        </AnimatePresence>
    </div>
  );
};
