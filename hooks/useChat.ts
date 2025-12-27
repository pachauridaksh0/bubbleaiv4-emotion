
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './useToast';
import { Project, Message, Chat, WorkspaceMode, ChatWithProjectData, EmotionData } from '../types';
import { 
    getAllChatsForUser, 
    addMessage, 
    updateChat as updateDbChat, 
    getMessages, 
    deleteChat, 
    updateMessagePlan,
    getChatsForProject,
    extractAndSaveMemory,
    getProject
} from '../services/databaseService';
import { localChatService } from '../services/localChatService';
import { generateChatTitle } from '../services/geminiService';
import { runAgent } from '../agents';
import { User } from '@supabase/supabase-js';
import { AgentExecutionResult } from '../agents/types';
import { NEW_CHAT_NAME } from '../constants';
import { emotionEngine } from '../services/emotionEngine';

const DUMMY_AUTONOMOUS_PROJECT: Project = {
  id: 'autonomous-project',
  user_id: 'unknown',
  name: 'Autonomous Chat',
  description: 'A personal chat with the AI.',
  status: 'In Progress',
  platform: 'Web App',
  project_type: 'conversation',
  default_model: 'gemini-2.5-flash',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

interface UseChatProps {
    user: User | null;
    geminiApiKey: string | null;
    workspaceMode: WorkspaceMode;
    adminProject?: Project | null; 
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

interface Attachment {
    type: string;
    data: string;
    name: string;
}

export type AIStatus = 'idle' | 'thinking' | 'planning' | 'building' | 'fixing' | 'error';

export const useChat = ({ user, geminiApiKey, workspaceMode, adminProject }: UseChatProps) => {
    const { supabase, profile, isGuest } = useAuth();
    const { addToast } = useToast();

    const [allChats, setAllChats] = useState<ChatWithProjectData[]>([]);
    const [activeChat, setActiveChat] = useState<ChatWithProjectData | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    
    // AI Execution State
    const [aiStatus, setAiStatus] = useState<AIStatus>('idle');
    const [activityLog, setActivityLog] = useState<string[]>([]);
    
    // Emotion Engine State
    const [currentEmotion, setCurrentEmotion] = useState<string>('Neutral');
    const [modelLoadingProgress, setModelLoadingProgress] = useState(0);
    
    const [activeUsersCount, setActiveUsersCount] = useState(1);
    
    // Refs for persistence and state tracking
    const isSendingRef = useRef(false);
    // Critical: Track the active chat ID in a ref to prevent race conditions in async callbacks
    const activeChatIdRef = useRef<string | null>(null);
    const isMountedRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);
    const previousChatIdRef = useRef<string | null>(null);

    useEffect(() => {
        // Initialize Emotion Engine in background with progress tracking
        emotionEngine.setProgressCallback((progress) => {
            if (isMountedRef.current) {
                setModelLoadingProgress(progress);
            }
        });
        
        // Initial non-blocking load check - ONLY if in autonomous mode to save resources for project users
        if (workspaceMode === 'autonomous') {
            setTimeout(() => {
                 emotionEngine.init().catch(e => console.warn("Background emotion engine init failed", e));
            }, 1000); 
        }
        
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, [workspaceMode]);

    // Sync ref with state
    useEffect(() => {
        const currentId = activeChat?.id || null;
        activeChatIdRef.current = currentId;

        // Only clear messages if we are actually switching to a different valid chat ID
        if (currentId && previousChatIdRef.current && currentId !== previousChatIdRef.current) {
            setMessages([]); 
            // Reset AI status on chat switch
            setAiStatus('idle');
            setActivityLog([]);
            setCurrentEmotion('Neutral');
        }
        previousChatIdRef.current = currentId;
    }, [activeChat?.id]); 

    // LAZY LOADING PROJECT FILES
    useEffect(() => {
        if (activeChat?.project_id && (!activeChat.projects || !activeChat.projects.files) && supabase && !isGuest) {
            if (adminProject && adminProject.id === activeChat.project_id) return;

            getProject(supabase, activeChat.project_id).then(fullProject => {
                if (fullProject && isMountedRef.current) {
                    setActiveChat(prev => {
                        if (prev && prev.id === activeChat.id) {
                            return { ...prev, projects: fullProject };
                        }
                        return prev;
                    });
                    setAllChats(prev => prev.map(c => c.project_id === fullProject.id ? { ...c, projects: fullProject } : c));
                }
            }).catch(err => console.error("Failed to lazy load project files:", err));
        }
    }, [activeChat?.id, activeChat?.project_id, supabase, isGuest, adminProject]);

    const activeProject = useMemo(() => adminProject ?? activeChat?.projects ?? null, [adminProject, activeChat]);
    
    useEffect(() => {
        if (!supabase || (!user && !isGuest)) return;
        let isCancelled = false;
        const fetchChats = async () => {
            if (allChats.length === 0) setIsLoading(true);
            try {
                let chats: ChatWithProjectData[] = [];
                if (isGuest) {
                    chats = await localChatService.getAllChats();
                } else if (adminProject) {
                    const projectChats = await getChatsForProject(supabase, adminProject.id);
                    chats = projectChats.map(c => ({...c, projects: adminProject }));
                } else if(user) {
                    chats = await getAllChatsForUser(supabase, user.id);
                }
                if (!isCancelled && isMountedRef.current) {
                    setAllChats(chats);
                }
            } catch (error) {
                console.error("Error fetching chats:", error);
            } finally {
                if (!isCancelled && isMountedRef.current) setIsLoading(false);
            }
        };
        fetchChats();
        return () => { isCancelled = true; };
    }, [user, supabase, adminProject, isGuest]);

    useEffect(() => {
        let isCancelled = false;
        let channel: any = null;

        const fetchMessages = async () => {
            if (activeChat) {
                const chatId = activeChat.id;
                // Only set loading if we aren't currently sending a message to avoid flicker
                if (!isSendingRef.current && isMountedRef.current && messages.length === 0) {
                    setIsLoading(true);
                }
                try {
                    let history: Message[] = [];
                    if (isGuest) {
                        history = await localChatService.getMessages(chatId);
                    } else if (supabase) {
                        history = await getMessages(supabase, chatId);
                    }
                    // RACE CONDITION CHECK: Ensure we are still on the same chat
                    if (!isCancelled && isMountedRef.current && activeChatIdRef.current === chatId) {
                        setMessages(prev => {
                            const pendingOptimistic = prev.filter(p => p.id.startsWith('temp-'));
                            if (history.length === 0 && pendingOptimistic.length > 0) {
                                return pendingOptimistic;
                            }
                            const merged = [...history];
                            pendingOptimistic.forEach(opt => {
                                const isSaved = history.some(h => (h.text === opt.text && h.sender === opt.sender) || h.id === opt.id);
                                if (!isSaved) merged.push(opt);
                            });
                            return merged;
                        });
                    }
                } catch (error) { 
                    console.error("Error fetching messages:", error);
                } 
                finally { 
                    if (!isCancelled && isMountedRef.current && activeChatIdRef.current === chatId) setIsLoading(false); 
                }
            } else {
                if (isMountedRef.current) setMessages([]);
            }
        };

        fetchMessages();
        
        if (activeChat && supabase && !isGuest) {
            const channelName = `chat-room:${activeChat.id}`;
            channel = supabase.channel(channelName)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages', 
                    filter: `chat_id=eq.${activeChat.id}` 
                }, (payload) => {
                    if (!isMountedRef.current) return;
                    const newMsg = payload.new as Message;
                    // STRICT CHECK: Only update state if this message belongs to the currently viewed chat
                    if (activeChatIdRef.current === activeChat.id) {
                        setMessages(prev => {
                            if (prev.some(m => m.id === newMsg.id)) return prev;
                            const filtered = prev.filter(m => {
                                if (!m.id.startsWith('temp-')) return true;
                                // Dedupe optimistic messages
                                return !(m.text === newMsg.text && m.sender === newMsg.sender);
                            });
                            return [...filtered, newMsg];
                        });
                    }
                })
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    setActiveUsersCount(Object.keys(state).length);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track({ online_at: new Date().toISOString(), user_id: user?.id });
                    }
                });
        }

        return () => { 
            isCancelled = true;
            if (channel) {
                supabase.removeChannel(channel); 
            }
        };
    }, [activeChat?.id, supabase, isGuest]);

    const handleUpdateChat = useCallback(async (chatId: string, updates: Partial<Chat>) => {
        try {
            if (isGuest) {
                await localChatService.updateChat(chatId, updates);
            } else if (supabase) {
                await updateDbChat(supabase, chatId, updates);
            }
            
            setAllChats(prev => prev.map(c => c.id === chatId ? { ...c, ...updates } : c));
            if (activeChat?.id === chatId) {
                setActiveChat(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (error) {
            console.error("Failed to update chat:", error);
            addToast("Failed to update chat", "error");
        }
    }, [isGuest, supabase, activeChat?.id, addToast]);

    const handleSelectChat = useCallback((chat: ChatWithProjectData) => {
        setActiveChat(chat);
        // Instant update of ref for synchronous checks
        activeChatIdRef.current = chat.id;
    }, []);

    const handleDeleteChat = useCallback(async (chatId: string) => {
        try {
            if (isGuest) {
                await localChatService.deleteChat(chatId);
            } else if (supabase) {
                await deleteChat(supabase, chatId);
            }
            
            setAllChats(prev => prev.filter(c => c.id !== chatId));
            if (activeChat?.id === chatId) {
                setActiveChat(null);
                activeChatIdRef.current = null;
                setMessages([]);
            }
            addToast("Chat deleted", "info");
        } catch (error) {
            console.error("Failed to delete chat:", error);
            addToast("Failed to delete chat", "error");
        }
    }, [isGuest, supabase, activeChat?.id, addToast]);

    const handleStopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsSending(false);
        setIsLoading(false);
        isSendingRef.current = false;
        setAiStatus('idle');
        addToast("Generation stopped.", "info");
    }, [addToast]);

    const handleSendMessage = useCallback(async (
        text: string, 
        files: File[] | null = null, 
        chatToUse: ChatWithProjectData | null = activeChat,
        thinkingModeOrOverride?: 'instant' | 'fast' | 'think' | 'deep' | string, 
        onProjectFileUpdate?: (path: string, content: string, isComplete: boolean) => void
    ): Promise<AgentExecutionResult> => {
      
      let effectiveMode = thinkingModeOrOverride;
      if (!effectiveMode) {
          effectiveMode = geminiApiKey ? 'fast' : 'instant';
      }

      const isInstantMode = effectiveMode === 'instant';
      const modelOverride = typeof effectiveMode === 'string' && !['instant', 'fast', 'think', 'deep'].includes(effectiveMode) ? effectiveMode : undefined;

      if ((!text.trim() && (!files || files.length === 0)) || (!user && !isGuest) || !chatToUse) return { messages: [] };
      
      const isGroupContext = workspaceMode === 'cocreator' && activeUsersCount > 1;
      const isMentioned = text.toLowerCase().includes('@bubble') || text.toLowerCase().includes('@ai');
      
      if (isGroupContext && !isMentioned) {
          // Silent message
      }

      if (isSendingRef.current) return { messages: [] };
      isSendingRef.current = true;
      setIsSending(true); // Update UI state
      setIsLoading(true);
      setAiStatus('thinking'); 
      setActivityLog([]); 

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const safetyTimeout = setTimeout(() => {
          if (isSendingRef.current && !abortController.signal.aborted) {
              console.warn("Response timed out.");
              abortController.abort();
              isSendingRef.current = false;
              if (isMountedRef.current) {
                  setIsSending(false);
                  setIsLoading(false);
                  setAiStatus('error');
              }
              addToast("Response timed out. The operation took too long.", "error");
          }
      }, 300000); 

      const tempId = `temp-ai-${Date.now()}`;
      const tempUserMsgId = `temp-user-${Date.now()}`;
      let currentText = '';
      const targetChatId = chatToUse.id;
      
      // Update ref immediately to ensure we track this operation context
      if (chatToUse && activeChatIdRef.current !== targetChatId) {
          activeChatIdRef.current = targetChatId;
      }

      try {
        let processedPrompt = text;
        const attachments: Attachment[] = [];
        const agentFiles: File[] = [];

        if (files && files.length > 0) {
            for (const file of files) {
                const mimeType = file.type;
                const fileName = file.name.toLowerCase();
                if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName)) {
                    const b64 = await fileToBase64(file);
                    attachments.push({ type: mimeType || 'image/jpeg', data: b64, name: file.name });
                    agentFiles.push(file); 
                } else {
                    attachments.push({ type: 'application/octet-stream', data: '', name: file.name });
                    agentFiles.push(file); 
                }
            }
        }

        const displayText = text.trim() === '' && files && files.length > 0 ? "" : text;

        // UI OPTIMIZATION: Render User Bubble Immediately
        const userMessageData: Omit<Message, 'id' | 'created_at'> = {
          project_id: chatToUse.project_id,
          chat_id: chatToUse.id,
          user_id: user ? user.id : 'guest', 
          text: displayText, 
          sender: 'user',
          // Default friendly emotion if waiting for model
          emotionData: { dominant: 'Friendly (Default)', scores: { Joy: 50, Neutral: 50 } },
        };

        if (attachments.length > 0) userMessageData.image_base64 = JSON.stringify(attachments);
        const optimisticUserMessage: Message = { ...userMessageData, id: tempUserMsgId, created_at: new Date().toISOString() };
        
        const shouldGenerate = !isGroupContext || isMentioned;
        const tempAiMessage: Message | null = shouldGenerate ? { id: tempId, project_id: chatToUse.project_id, chat_id: chatToUse.id, text: '', sender: 'ai' } : null;
        
        // Optimistic UI Update - ONLY if still on the same chat
        if (isMountedRef.current && (activeChatIdRef.current === targetChatId)) {
            setMessages(prev => tempAiMessage ? [...prev, optimisticUserMessage, tempAiMessage] : [...prev, optimisticUserMessage]);
        }

        // --- EMOTION ANALYSIS (NON-BLOCKING) ---
        // Only run for Autonomous chats (no project_id). Projects don't use the emotional engine.
        // If ready -> Run analysis (fast). 
        // If not ready -> Run init in background, proceed with default friendly emotion immediately.
        let detectedEmotionData: EmotionData | undefined;
        
        if (text.trim().length > 0 && !chatToUse.project_id) {
             const historyMessages = messages.length > 0 ? messages : [];
             const lastAiMessage = historyMessages.length > 0 && historyMessages[historyMessages.length - 1].sender === 'ai' ? historyMessages[historyMessages.length - 1].text : undefined;
             const lastUserMessage = historyMessages.length > 1 && historyMessages[historyMessages.length - 2].sender === 'user' ? historyMessages[historyMessages.length - 2] : undefined;
             const lastEmotion = lastUserMessage?.emotionData;

             if (emotionEngine.isModelReady()) {
                 try {
                    detectedEmotionData = await emotionEngine.analyze(text, lastAiMessage, lastEmotion);
                    if (isMountedRef.current && activeChatIdRef.current === targetChatId) {
                        setCurrentEmotion(detectedEmotionData.dominant);
                    }
                 } catch (e) {
                    console.warn("Emotion analysis failed, using default");
                 }
             } else {
                 // Background init, do not await
                 setTimeout(() => emotionEngine.init(), 0);
                 // Fallback explicit instruction for friendly behavior
                 detectedEmotionData = { dominant: 'Friendly', scores: { Joy: 80, Curiosity: 20 } };
             }
        }
        
        if (detectedEmotionData) {
            userMessageData.emotionData = detectedEmotionData;
        }

        try {
            if (isGuest) await localChatService.addMessage(userMessageData);
            else if (supabase) await addMessage(supabase, userMessageData);
        } catch (dbError) { console.error("Failed to save user message:", dbError); }

        if (text.trim()) {
             generateChatTitle(text.trim(), "", geminiApiKey).then(newTitle => {
                if (newTitle && newTitle !== "New Chat" && chatToUse.name === NEW_CHAT_NAME) {
                    handleUpdateChat(chatToUse.id, { name: newTitle });
                }
            }).catch(e => {});
        }

        if (!shouldGenerate) {
            isSendingRef.current = false;
            setIsSending(false);
            setIsLoading(false);
            setAiStatus('idle');
            return { messages: [] };
        }

        const agentHistory = messages.map(m => m);
        
        const onStreamChunk = (chunk: string) => {
            if (abortController.signal.aborted) return;
            clearTimeout(safetyTimeout);
            
            // Only update UI state if the user is still looking at THIS chat
            if (activeChatIdRef.current === targetChatId) {
                if (chunk.includes("<THINK>")) {
                    setAiStatus("planning");
                    setActivityLog(prev => [...prev, "🧠 Architect phase started..."]);
                } else if (chunk.includes("</THINK>")) {
                    setAiStatus("building");
                    setActivityLog(prev => [...prev, "✅ Planning complete.", "🏗️ Builder phase running..."]);
                } else if (chunk.includes("[FILE:")) {
                    setAiStatus("building");
                }

                currentText += chunk;
                if (isMountedRef.current) {
                    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, text: currentText } : m));
                }
            } else {
                // If user switched chats, just accumulate text for DB saving
                currentText += chunk;
            }
        };

        const projectForAgent = chatToUse.projects ?? { ...DUMMY_AUTONOMOUS_PROJECT, user_id: user ? user.id : 'guest' };
        
        let modelToUse = 'gemini-2.5-flash';
        if (modelOverride) {
            modelToUse = modelOverride;
        } else if (!isGuest && profile) {
             modelToUse = (workspaceMode === 'cocreator' ? (profile.preferred_code_model || profile.preferred_chat_model) : profile.preferred_chat_model) || 'gemini-2.5-flash';
        }

        // Run Agent - this continues even if chat is switched
        const agentResult = await runAgent({
            prompt: processedPrompt, 
            files: agentFiles, 
            apiKey: geminiApiKey || '', 
            model: modelToUse,
            project: projectForAgent, 
            chat: chatToUse, 
            user: user || { id: 'guest', email: 'guest', app_metadata: {}, user_metadata: {}, aud: 'guest', created_at: '' } as any, 
            profile: profile || null, 
            supabase: supabase as any, 
            history: agentHistory, 
            onStreamChunk, 
            onFileUpdate: (path, content, isComplete) => {
                if (activeChatIdRef.current === targetChatId) {
                    setAiStatus("fixing"); 
                }
                if(onProjectFileUpdate) onProjectFileUpdate(path, content, isComplete);
            },
            workspaceMode,
            thinkingMode: effectiveMode as any,
            signal: abortController.signal,
            userEmotion: detectedEmotionData as any 
        });
        
        if (abortController.signal.aborted) {
            setAiStatus('idle');
            return { messages: [] };
        }

        const { messages: agentMessages, updatedPlan } = agentResult;
        const savedAiMessages: Message[] = [];
        let finalAiText = "";

        // Save results to DB
        for (const messageContent of agentMessages) {
            const finalContent = messageContent.text || currentText; 
            finalAiText += finalContent + " ";
            try {
                let finalModelName = messageContent.model;
                if (!finalModelName) {
                     finalModelName = isInstantMode ? 'Instant (Puter)' : modelToUse;
                }

                let savedAiMessage: Message;
                const aiData = { 
                    ...messageContent, 
                    text: finalContent, 
                    project_id: chatToUse.project_id,
                    model: finalModelName
                };

                if (isGuest) savedAiMessage = await localChatService.addMessage(aiData);
                else if (supabase) savedAiMessage = await addMessage(supabase, aiData);
                else throw new Error("No storage backend available");
                savedAiMessages.push(savedAiMessage);
            } catch (aiDbError) { console.error("Failed to save AI message:", aiDbError); }
        }
        
        if (supabase && (user || isGuest)) {
            const userId = user ? user.id : 'guest';
            extractAndSaveMemory(supabase, userId, text, finalAiText, chatToUse.project_id);
        }
        
        // Final UI update - only if still viewing the same chat
        if (isMountedRef.current && (activeChatIdRef.current === targetChatId)) {
            setMessages(prev => {
                const newMessages = [...prev];
                const tempMessageIndex = newMessages.findIndex(m => m.id === tempId);
                if (tempMessageIndex !== -1) {
                    if (savedAiMessages.length > 0) newMessages.splice(tempMessageIndex, 1, ...savedAiMessages);
                    else newMessages.splice(tempMessageIndex, 1);
                } else if (savedAiMessages.length > 0) {
                     newMessages.push(...savedAiMessages);
                }
                if (updatedPlan) return newMessages.map(m => m.id === updatedPlan.messageId ? { ...m, plan: updatedPlan.plan } : m);
                return newMessages;
            });
            setAiStatus('idle');
            setActivityLog(prev => [...prev, "✨ Task completed."]);
        }

        if (updatedPlan && !isGuest && supabase) await updateMessagePlan(supabase, updatedPlan.messageId, updatedPlan.plan);
        
        return agentResult;

      } catch (e: any) {
        if (abortController.signal.aborted || e.name === 'AbortError') {
            setAiStatus('idle');
            return { messages: [] };
        }
        const errorMessage = e?.message || "An unknown error occurred.";
        console.error("Message execution failed:", e);
        addToast(`Error: ${errorMessage}`, "error");
        
        if (isMountedRef.current && activeChatIdRef.current === targetChatId) {
            setAiStatus('error');
            setActivityLog(prev => [...prev, `❌ Error: ${errorMessage}`]);
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, text: `⚠️ I encountered an error: ${errorMessage}`, sender: 'ai' } : m));
        }
        return { messages: [] };
      } finally {
        clearTimeout(safetyTimeout);
        isSendingRef.current = false;
        if (isMountedRef.current && activeChatIdRef.current === targetChatId) {
            setIsSending(false);
            setIsLoading(false);
        }
      }
    }, [activeChat, supabase, user, geminiApiKey, messages, addToast, profile, workspaceMode, handleUpdateChat, isGuest, activeUsersCount]);
    
    return {
        allChats, setAllChats, activeChat, setActiveChat, messages, setMessages,
        isLoading, isSending, isCreatingChat, setIsCreatingChat, activeProject,
        handleUpdateChat, handleSelectChat, handleDeleteChat, handleSendMessage, handleStopGeneration,
        aiStatus, activityLog, currentEmotion, modelLoadingProgress
    };
};
