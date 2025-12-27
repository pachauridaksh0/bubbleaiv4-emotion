
import React, { useState, useRef, useEffect, ClipboardEvent } from 'react';
import { PaperAirplaneIcon, ChevronDownIcon, PlusIcon, ChevronRightIcon, XMarkIcon, MicrophoneIcon, DocumentIcon, PhoneIcon, BoltIcon, SparklesIcon, LightBulbIcon as LightBulbSolid, StopIcon, RocketLaunchIcon, LockClosedIcon, FaceSmileIcon } from '@heroicons/react/24/solid';
import { Chat, ChatMode, WorkspaceMode, Project, ChatWithProjectData } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChatBubbleLeftEllipsisIcon, CpuChipIcon, PuzzlePieceIcon, AcademicCapIcon, PaperClipIcon, PhotoIcon, LightBulbIcon, BeakerIcon, BookOpenIcon, EllipsisHorizontalIcon, GlobeAltIcon, PaintBrushIcon, ComputerDesktopIcon, FilmIcon, ChartPieIcon, DocumentTextIcon, MagnifyingGlassIcon, ArchiveBoxIcon
} from '@heroicons/react/24/outline';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';
import { emotionEngine } from '../../services/emotionEngine';
import { useChat } from '../../hooks/useChat';

const CubeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9.75v9.75" />
    </svg>
);

const WaveformIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 10C4 9.44772 4.44772 9 5 9C5.55228 9 6 9.44772 6 10V14C6 14.5523 5.55228 15 5 15C4.44772 15 4 14.5523 4 14V10Z" />
        <path d="M8 8C8 7.44772 8.44772 7 9 7C9.55228 7 10 7.44772 10 8V16C10 16.5523 9.55228 17 9 17C8.44772 17 8 16.5523 8 16V8Z" />
        <path d="M12 6C12 5.44772 12.4477 5 13 5C13.5523 5 14 5.44772 14 6V18C14 18.5523 13.5523 19 13 19C12.4477 19 12 18.5523 12 18V6Z" />
        <path d="M16 8C16 7.44772 16.4477 7 17 7C17.5523 7 18 7.44772 18 8V16C18 16.5523 17.5523 17 17 17C16.4477 17 16 16.5523 16 16V8Z" />
        <path d="M20 10C20 9.44772 20.4477 9 21 9C21.5523 9 22 9.44772 22 10V14C22 14.5523 21.5523 15 21 15C20.4477 15 20 14.5523 20 14V10Z" />
    </svg>
);

type ActionId = 'default' | 'files' | 'image' | 'think' | 'research' | 'study' | 'search' | 'canvas' | 'roblox' | 'website' | 'video' | 'story' | 'presentation' | 'document' | 'deep_research' | 'quick_research';

const MAX_FILES = 15;
const MAX_FILE_SIZE_MB = 20; 
const MAX_TEXT_PASTE_LENGTH = 10000; 

interface ChatInputProps {
  onSendMessage: (text: string, files?: File[] | null, thinkingMode?: 'instant' | 'fast' | 'think' | 'deep') => void;
  onStop?: () => void;
  isLoading: boolean;
  chat: ChatWithProjectData | null; 
  onChatUpdate: ((updates: Partial<Chat>) => void) | null;
  isAdmin: boolean;
  workspaceMode: WorkspaceMode;
  isInitialView: boolean;
  loadingMessage: string;
  project: Project | null;
  selectedAction: string;
  onActionSelect: (action: string) => void;
  onStartLive?: () => void;
  onRequireAuth?: () => void; 
  isSending?: boolean; 
}

const actionMap: Record<string, { name: string, icon: React.ReactElement, placeholder: string }> = {
    default: { name: 'Ask anything', icon: <PlusIcon />, placeholder: 'Ask anything, or attach a file...' },
    files: { name: 'Files', icon: <PaperClipIcon />, placeholder: 'Describe the file(s) or add a prompt' },
    image: { name: 'Image', icon: <PhotoIcon />, placeholder: 'Describe an image to generate' },
    think: { name: 'Think', icon: <LightBulbIcon />, placeholder: 'Ask anything' },
    study: { name: 'Study', icon: <BookOpenIcon />, placeholder: 'Learn something new' },
    research: { name: 'Research', icon: <BeakerIcon />, placeholder: 'What should we research?' },
    deep_research: { name: 'Deep Research', icon: <BeakerIcon />, placeholder: 'Get a detailed report on a topic...' },
    quick_research: { name: 'Quick Search', icon: <MagnifyingGlassIcon />, placeholder: 'Get a quick summary on a topic...' },
    search: { name: 'Web Search', icon: <GlobeAltIcon />, placeholder: 'Search the web for real-time information' },
    canvas: { name: 'Canvas', icon: <PaintBrushIcon />, placeholder: 'Describe your canvas idea' },
    roblox: { name: 'Roblox Project', icon: <CubeIcon />, placeholder: 'Describe the Roblox game you want to create...' },
    website: { name: 'Website Project', icon: <ComputerDesktopIcon />, placeholder: 'Describe the website you want to build...' },
    video: { name: 'Video Project', icon: <FilmIcon />, placeholder: 'Describe the video you want to make...' },
    story: { name: 'Story Project', icon: <BookOpenIcon />, placeholder: 'Describe the story you want to write...' },
    presentation: { name: 'Presentation', icon: <ChartPieIcon />, placeholder: 'Describe the presentation you want to create...' },
    document: { name: 'Document', icon: <DocumentTextIcon />, placeholder: 'Describe the document you need help with...' },
};

const imageStyles = [
    { name: 'Cyberpunk', img: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?q=80&w=200' },
    { name: 'Anime', img: 'https://images.unsplash.com/photo-1607338148906-4444b3c15432?q=80&w=200' },
    { name: 'Dramatic Headshot', img: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200' },
    { name: 'Coloring Book', img: 'https://images.unsplash.com/photo-1588275582395-57d45479261a?q=80&w=200' },
    { name: 'Photo Shoot', img: 'https://images.unsplash.com/photo-1520423465853-27bde2bf3133?q=80&w=200' },
    { name: 'Retro Cartoon', img: 'https://images.unsplash.com/photo-1634636979027-18a034d687a8?q=80&w=200' },
];

const MenuItem: React.FC<{ icon: React.ReactElement, text: string, onClick: () => void, hasChevron?: boolean, isSelected?: boolean, locked?: boolean }> = ({ icon, text, onClick, hasChevron = false, isSelected = false, locked = false }) => {
    const Icon = icon.type as any;
    return (
        <button 
            onClick={locked ? undefined : onClick} 
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left ${locked ? 'text-gray-500 cursor-not-allowed' : 'text-text-secondary hover:bg-interactive-hover hover:text-text-primary'}`}
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{text}</span>
            {locked ? (
                <LockClosedIcon className="w-4 h-4 text-gray-600" />
            ) : (
                <>
                    {hasChevron && <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
                    {isSelected && <span className="text-primary-start">✓</span>}
                </>
            )}
        </button>
    );
};

const FilePreview: React.FC<{ file: File; onRemove: () => void; }> = ({ file, onRemove }) => {
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.name);
    
    const getIcon = () => {
        if (isImage) return null; 
        if (file.name.endsWith('.pdf') || file.type === 'application/pdf') return <DocumentTextIcon className="w-5 h-5 text-red-400"/>;
        if (file.name.match(/\.(docx|doc)$/)) return <DocumentTextIcon className="w-5 h-5 text-blue-400"/>;
        if (file.name.match(/\.(pptx|ppt)$/)) return <DocumentTextIcon className="w-5 h-5 text-orange-400"/>;
        if (file.name.match(/\.(xlsx|xls|csv)$/)) return <DocumentTextIcon className="w-5 h-5 text-green-400"/>;
        if (file.name.match(/\.zip$/)) return <ArchiveBoxIcon className="w-5 h-5 text-yellow-400"/>;
        return <DocumentIcon className="w-5 h-5 text-text-secondary"/>;
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="relative flex-shrink-0 flex items-center gap-2 p-1.5 pl-2 bg-bg-tertiary rounded-lg text-sm text-text-primary h-12 border border-border-color"
        >
            {isImage ? (
                <img src={URL.createObjectURL(file)} alt="Preview" className="w-9 h-9 rounded-md object-cover" />
            ) : (
                <div className="w-9 h-9 flex items-center justify-center bg-bg-secondary rounded-md flex-shrink-0">
                    {getIcon()}
                </div>
            )}
            <div className="flex flex-col min-w-[80px] max-w-[150px]">
                <span className="truncate text-xs font-medium" title={file.name}>{file.name}</span>
                <span className="text-[10px] text-text-secondary">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
            <button type="button" onClick={onRemove} className="ml-1 flex-shrink-0 p-1 bg-black/20 rounded-full text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"><XMarkIcon className="w-4 h-4"/></button>
        </motion.div>
    );
};

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, onStop, isLoading, chat, onChatUpdate, isAdmin, workspaceMode, isInitialView, loadingMessage, project, selectedAction, onActionSelect, onStartLive, onRequireAuth }) => {
  const { addToast } = useToast();
  const { isGuest, geminiApiKey, user } = useAuth();
  
  const [modelLoadingProgress, setModelLoadingProgress] = useState(0);

  useEffect(() => {
      // Small hack to poll progress since we can't easily add a listener to the singleton without modifying it more
      // But we did add setProgressCallback!
      const updateProgress = (p: number) => setModelLoadingProgress(p);
      emotionEngine.setProgressCallback(updateProgress);
      return () => { emotionEngine.setProgressCallback(() => {}); };
  }, []);

  const draftKey = `chat_draft_${chat?.id || 'new'}`;
  const [text, setText] = useLocalStorage<string>(draftKey, '');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [isStylesMenuOpen, setIsStylesMenuOpen] = useState(false);
  const stylesMenuRef = useRef<HTMLDivElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isResearchSubMenuOpen, setIsResearchSubMenuOpen] = useState(false);
  const [isMoreSubMenuOpen, setIsMoreSubMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const [thinkingMode, setThinkingMode] = useState<'instant' | 'fast' | 'think' | 'deep'>(
      geminiApiKey ? 'fast' : 'instant'
  );
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false); 
  
  const isStrictBuildMode = project?.project_type === 'website';

  useEffect(() => {
      if (geminiApiKey && thinkingMode === 'instant') {
          setThinkingMode('fast');
      }
  }, [geminiApiKey]);

  // REMOVED: Real-time emotion analysis useEffect to prevent typing lag.
  // Analysis is now only performed on submit inside useChat.ts.

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
        processFiles(Array.from(files));
    }
    if (event.target) event.target.value = '';
  };

  const processFiles = (newFiles: File[]) => {
      if (attachedFiles.length + newFiles.length > MAX_FILES) {
          addToast(`Maximum ${MAX_FILES} files allowed.`, 'error');
          return;
      }

      const validFiles: File[] = [];
      for (const file of newFiles) {
          if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
              addToast(`File ${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit.`, 'error');
              continue;
          }
          validFiles.push(file);
      }

      if (validFiles.length > 0) {
          setAttachedFiles(prev => [...prev, ...validFiles]);
      }
  };
  
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardData = e.clipboardData;
      const pastedText = clipboardData.getData('text');

      if (pastedText.length > MAX_TEXT_PASTE_LENGTH) {
          e.preventDefault();
          addToast("Text too long! Converted to a file attachment.", 'info');
          const file = new File([pastedText], "paste.txt", { type: "text/plain" });
          processFiles([file]);
      } else if (clipboardData.files.length > 0) {
          e.preventDefault();
          processFiles(Array.from(clipboardData.files));
      }
  };
  
  const handleRemoveFile = (fileToRemove: File) => {
    setAttachedFiles(prev => prev.filter(f => f !== fileToRemove));
  };
  
  const handleActionSelect = (action: string) => {
    if (action === 'files') {
      fileInputRef.current?.click();
      setIsActionsMenuOpen(false);
      return;
    }
    
    if (isGuest && action !== 'files' && action !== 'default') {
        addToast("This feature is not available in Guest Mode.", "info");
        return;
    }

    onActionSelect(action === selectedAction ? 'default' : action);
    setIsActionsMenuOpen(false);
  };
  
  const currentActionDetails = attachedFiles.length > 0 ? actionMap['files'] : actionMap[selectedAction] || actionMap.default;
  const ActionIcon = currentActionDetails.icon.type as any;

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(adjustTextareaHeight, [text]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) setIsActionsMenuOpen(false);
        if (stylesMenuRef.current && !stylesMenuRef.current.contains(event.target as Node)) setIsStylesMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; 
    
    if (thinkingMode !== 'instant' && !geminiApiKey) {
        setShowApiKeyDialog(true);
        return;
    }
    
    if ((text.trim() || attachedFiles.length > 0)) {
      let promptText = text;
      if (selectedAction === 'search' || selectedAction === 'quick_research') {
          promptText = `<SEARCH>${text}</SEARCH>`;
      } else if (selectedAction === 'deep_research') {
          promptText = `<DEEP>${text}</DEEP>`;
      }
      
      onSendMessage(promptText, attachedFiles, thinkingMode);
      setText(''); 
      setAttachedFiles([]);
      onActionSelect('default');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
    }
  };

  const cycleMode = (e: React.MouseEvent) => {
      e.preventDefault();
      if (isGuest && !geminiApiKey) {
          addToast("Guests without API Key are limited to Instant mode.", "info");
          return;
      }
      setThinkingMode(prev => {
          if (prev === 'instant') return 'fast';
          if (prev === 'fast') return 'think';
          if (prev === 'think') return 'deep';
          return 'instant';
      });
  };

  const getModeIcon = () => {
      switch(thinkingMode) {
          case 'instant': return <RocketLaunchIcon className="w-3.5 h-3.5" />;
          case 'fast': return <BoltIcon className="w-3.5 h-3.5" />;
          case 'think': return <LightBulbSolid className="w-3.5 h-3.5" />;
          case 'deep': return <SparklesIcon className="w-3.5 h-3.5" />;
      }
  };

  const getModeLabel = () => {
      switch(thinkingMode) {
          case 'instant': return 'Instant';
          case 'fast': return 'Fast';
          case 'think': return 'Think';
          case 'deep': return 'Deep Think';
      }
  };

  const getModeColor = () => {
      switch(thinkingMode) {
          case 'instant': return 'bg-orange-500/20 text-orange-400 border-orange-500/50 hover:bg-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.25)] ring-1 ring-orange-500/40';
          case 'fast': return 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30';
          case 'think': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30';
          case 'deep': return 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30';
      }
  };

  const formClasses = `
    bg-bg-secondary/80 backdrop-blur-md border border-border-color shadow-2xl flex flex-col relative 
    rounded-3xl md:rounded-[2rem] 
    min-h-[60px] 
    md:flex-row md:items-center md:gap-2 md:p-2 md:pl-4
  `;
    
  const isInputEmpty = !text.trim() && attachedFiles.length === 0;

  return (
    <div className="relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        multiple 
        style={{ display: 'none' }} 
        accept=".pdf,.doc,.docx,.txt,.md,.js,.ts,.tsx,.jsx,.html,.css,.json,.png,.jpg,.jpeg,.gif,.svg,.csv,.xml,.pptx,.zip"
      />
      
      <AnimatePresence>
          {showApiKeyDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-bg-secondary border border-border-color rounded-xl p-6 max-w-sm w-full shadow-2xl"
                  >
                      <div className="flex items-center gap-3 mb-4 text-text-primary">
                          <BoltIcon className="w-6 h-6 text-yellow-400" />
                          <h3 className="font-bold text-lg">API Key Required</h3>
                      </div>
                      <p className="text-text-secondary mb-6 text-sm">
                          To use advanced models like <strong>{getModeLabel()}</strong>, you need to add your own API key. 
                          <br/><br/>
                          Without a key, you can continue using <strong>Instant Mode</strong> for free.
                      </p>
                      <div className="flex flex-col gap-2">
                          <button 
                              onClick={() => { setShowApiKeyDialog(false); if (onRequireAuth) onRequireAuth(); }} 
                              className="w-full py-2 bg-primary-start text-white font-bold rounded-lg hover:bg-primary-start/80 transition-colors"
                          >
                              Add API Key
                          </button>
                          <button 
                              onClick={() => { 
                                  setThinkingMode('instant'); 
                                  setShowApiKeyDialog(false); 
                              }} 
                              className="w-full py-2 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-interactive-hover transition-colors"
                          >
                              Switch to Instant Mode
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {isActionsMenuOpen && (
              <motion.div
                  ref={actionsMenuRef}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute bottom-full left-2 mb-2 w-64 bg-bg-secondary/90 backdrop-blur-md border border-border-color rounded-xl shadow-2xl z-20"
              >
                  <div className="p-1.5">
                      <MenuItem icon={<PaperClipIcon />} text="Add photos & files" onClick={() => handleActionSelect('files')} />
                      
                      {!isStrictBuildMode && (
                          <>
                              <div className="border-t border-border-color my-1"></div>
                              <MenuItem icon={<PhotoIcon />} text="Create image" onClick={() => handleActionSelect('image')} locked={isGuest} />
                              <MenuItem icon={<LightBulbIcon />} text="Thinking" onClick={() => handleActionSelect('think')} locked={isGuest} />
                              <MenuItem icon={<BookOpenIcon />} text="Study and learn" onClick={() => handleActionSelect('study')} locked={isGuest} />
                              <div className="border-t border-border-color my-1"></div>
                              
                              <div 
                                  className="relative"
                                  onMouseEnter={() => setIsResearchSubMenuOpen(true)}
                                  onMouseLeave={() => setIsResearchSubMenuOpen(false)}
                              >
                                  <MenuItem icon={<BeakerIcon />} text="Research" onClick={() => setIsResearchSubMenuOpen(prev => !prev)} hasChevron locked={isGuest} />
                                  <AnimatePresence>
                                  {isResearchSubMenuOpen && !isGuest && (
                                      <motion.div
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          exit={{ opacity: 0, x: -10 }}
                                          transition={{ duration: 0.15 }}
                                          className="absolute left-full -top-1 ml-2 w-48 bg-bg-secondary/90 backdrop-blur-md border border-border-color rounded-xl shadow-2xl p-1.5 z-30"
                                      >
                                          <MenuItem icon={<MagnifyingGlassIcon />} text="Quick Search" onClick={() => handleActionSelect('quick_research')} isSelected={selectedAction === 'quick_research'} />
                                          <MenuItem icon={<BeakerIcon />} text="Deep Research" onClick={() => handleActionSelect('deep_research')} isSelected={selectedAction === 'deep_research'} />
                                          <MenuItem icon={<GlobeAltIcon />} text="Web Search" onClick={() => handleActionSelect('search')} isSelected={selectedAction === 'search'} />
                                      </motion.div>
                                  )}
                                  </AnimatePresence>
                              </div>

                              <div 
                                  className="relative"
                                  onMouseEnter={() => setIsMoreSubMenuOpen(true)}
                                  onMouseLeave={() => setIsMoreSubMenuOpen(false)}
                              >
                                  <MenuItem icon={<EllipsisHorizontalIcon />} text="More..." onClick={() => setIsMoreSubMenuOpen(prev => !prev)} hasChevron locked={isGuest} />
                                  <AnimatePresence>
                                  {isMoreSubMenuOpen && !isGuest && (
                                      <motion.div
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          exit={{ opacity: 0, x: -10 }}
                                          transition={{ duration: 0.15 }}
                                          className="absolute left-full bottom-0 ml-2 w-48 bg-bg-secondary/90 backdrop-blur-md border border-border-color rounded-xl shadow-2xl p-1.5 z-30"
                                      >
                                          <MenuItem icon={<PaintBrushIcon />} text="Canvas" onClick={() => handleActionSelect('canvas')} isSelected={selectedAction === 'canvas'}/>
                                          <MenuItem icon={<CubeIcon />} text="Roblox Project" onClick={() => handleActionSelect('roblox')} isSelected={selectedAction === 'roblox'}/>
                                          <MenuItem icon={<ComputerDesktopIcon />} text="Website Project" onClick={() => handleActionSelect('website')} isSelected={selectedAction === 'website'}/>
                                          <MenuItem icon={<FilmIcon />} text="Video Project" onClick={() => handleActionSelect('video')} isSelected={selectedAction === 'video'}/>
                                          <MenuItem icon={<BookOpenIcon />} text="Story Project" onClick={() => handleActionSelect('story')} isSelected={selectedAction === 'story'}/>
                                          <MenuItem icon={<ChartPieIcon />} text="Presentation" onClick={() => handleActionSelect('presentation')} isSelected={selectedAction === 'presentation'}/>
                                          <MenuItem icon={<DocumentTextIcon />} text="Document" onClick={() => handleActionSelect('document')} isSelected={selectedAction === 'document'}/>
                                      </motion.div>
                                  )}
                                  </AnimatePresence>
                              </div>
                          </>
                      )}
                  </div>
              </motion.div>
          )}
      </AnimatePresence>
      
      <AnimatePresence>
          {isStylesMenuOpen && (
              <motion.div
                  ref={stylesMenuRef}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-32 mb-2 p-2 bg-bg-secondary/90 backdrop-blur-md border border-border-color rounded-xl shadow-2xl z-20"
              >
                  <div className="grid grid-cols-3 gap-2">
                      {imageStyles.map(style => (
                          <button
                              key={style.name}
                              onClick={() => {
                                  setText(prev => `${prev}, in ${style.name.toLowerCase()} style`);
                                  setIsStylesMenuOpen(false);
                              }}
                              className="text-center group"
                          >
                              <img src={style.img} alt={style.name} className="w-20 h-20 object-cover rounded-md border-2 border-transparent group-hover:border-primary-start transition-colors" />
                              <span className="text-xs text-text-secondary mt-1 block">{style.name}</span>
                          </button>
                      ))}
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <div className="mx-auto w-full max-w-3xl px-2 lg:px-4">
        {/* Model Loading Progress Bar */}
        {modelLoadingProgress > 0 && modelLoadingProgress < 100 && (
            <div className="w-full max-w-xs mx-auto mb-2 text-center">
                <div className="flex justify-between text-[10px] text-primary-start mb-1 px-1">
                    <span>Loading model into memory...</span>
                    <span>{modelLoadingProgress}%</span>
                </div>
                <div className="h-1 w-full bg-bg-tertiary rounded-full overflow-hidden">
                    <motion.div 
                        className="h-full bg-primary-start" 
                        initial={{ width: 0 }}
                        animate={{ width: `${modelLoadingProgress}%` }}
                        transition={{ type: "spring", stiffness: 20 }}
                    />
                </div>
            </div>
        )}

        <motion.form
          layout
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onSubmit={handleSubmit}
          className={formClasses}
        >
          {/* File Previews - Always on top/left */}
          <AnimatePresence>
            {attachedFiles.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full px-2 pt-2 md:w-auto md:px-0 md:pt-0 order-first"
              >
                <div className="flex items-center gap-2 overflow-x-auto p-1 scrollbar-hide">
                  {attachedFiles.map((file, i) => (
                    <FilePreview key={`${file.name}-${i}`} file={file} onRemove={() => handleRemoveFile(file)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Badge */}
          <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full px-4 pt-3 pb-2 flex items-center justify-center gap-2 md:absolute md:-top-10 md:left-0 md:p-0 order-first md:order-none"
            >
                {selectedAction !== 'default' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary rounded-md text-sm text-text-primary border border-border-color shadow-sm">
                        <ActionIcon className="w-4 h-4" />
                        <span>{currentActionDetails.name}</span>
                    </div>
                )}

                {selectedAction === 'image' && (
                  <button
                    type="button"
                    onClick={() => setIsStylesMenuOpen(prev => !prev)}
                    className="flex items-center gap-1 px-2 py-1 ml-2 bg-bg-tertiary rounded-md text-sm text-text-primary hover:bg-interactive-hover"
                  >
                    <span>Styles</span>
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                )}
            </motion.div>
          </AnimatePresence>
          
          {/* LEFT BUTTONS - Mobile: separate row, Desktop: inline left */}
          <div className="flex items-center gap-2 px-3 pt-2 md:p-0 md:flex-shrink-0 order-1 md:order-1">
            <button
              type="button"
              onClick={() => setIsActionsMenuOpen(prev => !prev)}
              className="w-9 h-9 rounded-full bg-bg-tertiary md:bg-white/5 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-interactive-hover transition-colors flex-shrink-0"
              aria-label="Add file or use action"
              disabled={isLoading}
            >
              <PlusIcon className="w-5 h-5" />
            </button>
            
            {!isStrictBuildMode && (
              <button
                type="button"
                onClick={cycleMode}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 h-9 rounded-full text-xs font-bold uppercase tracking-wider transition-all border shadow-sm flex-shrink-0 ${getModeColor()}`}
                title={isGuest && !geminiApiKey ? "Guest Mode: Instant only (Add API Key to unlock)" : "Switch AI Mode"}
                disabled={isLoading}
              >
                {getModeIcon()}
                <span className="hidden sm:inline">{getModeLabel()}</span>
              </button>
            )}
          </div>

          {/* TEXT AREA - Mobile: full row, Desktop: grows to fill space */}
          <div className="w-full px-3 py-2 md:flex-1 md:px-0 md:py-0 order-2 md:order-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isRecording ? "Listening..." : currentActionDetails.placeholder}
              className="w-full h-full bg-transparent text-text-primary placeholder-text-secondary focus:outline-none resize-none overflow-y-auto text-base md:text-base min-h-[40px] md:min-h-[24px] max-h-[200px]"
              aria-label="Chat message input"
              rows={1}
            />
          </div>

          {/* RIGHT BUTTONS - Mobile: right side of bottom row, Desktop: inline right */}
          <div className="flex items-center gap-2 px-3 pb-2 md:p-0 md:flex-shrink-0 ml-auto md:ml-0 order-3 md:order-3">
            {isLoading && onStop ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onStop();
                }}
                className="w-9 h-9 rounded-full bg-red-500/80 flex items-center justify-center text-white shadow-lg transition-all hover:bg-red-600 animate-pulse flex-shrink-0"
                title="Stop Generating"
              >
                <StopIcon className="w-5 h-5" />
              </button>
            ) : isInputEmpty ? (
              (!isStrictBuildMode && workspaceMode !== 'cocreator') && (
                <button
                  type="button"
                  onClick={(e) => { 
                    e.preventDefault(); 
                    if (isGuest && !geminiApiKey) {
                      if (onRequireAuth) onRequireAuth();
                    } else {
                      if (onStartLive) onStartLive();
                    }
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-black/50 hover:bg-black/70 transition-all shadow-lg hover:scale-105 flex-shrink-0"
                  title={isGuest && !geminiApiKey ? "Login or Add Key to use Voice" : "Live Voice Mode"}
                >
                  <WaveformIcon className="w-5 h-5" />
                </button>
              )
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                className="w-9 h-9 rounded-full bg-bg-tertiary md:bg-white/10 flex items-center justify-center text-text-primary shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-interactive-hover flex-shrink-0"
                aria-label="Send message"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </motion.form>
      </div>
    </div>
  );
};
