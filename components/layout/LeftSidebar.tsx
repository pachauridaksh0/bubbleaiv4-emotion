
import React, { useState, useEffect, useRef } from 'react';
import { Chat, Profile, WorkspaceMode, Project, ChatWithProjectData } from '../../types';
import { Cog6ToothIcon, PencilIcon, PlusIcon, MagnifyingGlassIcon, ArrowLeftOnRectangleIcon, TrashIcon, ChevronDoubleLeftIcon, UserPlusIcon, Square2StackIcon, BellIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';

const SidebarToggleButton: React.FC<{
  isCollapsed: boolean;
  onToggle: () => void;
}> = ({ isCollapsed, onToggle }) => {
  return (
    <motion.button
      onClick={onToggle}
      className="p-1.5 text-text-secondary rounded-md hover:bg-interactive-hover hover:text-text-primary transition-colors"
      title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      // FIX: framer-motion props wrapped in a spread object to bypass type errors.
      {...{
        animate: { rotate: isCollapsed ? 180 : 0 },
        transition: { duration: 0.3 },
      }}
    >
      <ChevronDoubleLeftIcon className="w-5 h-5" />
    </motion.button>
  );
};

const FALLBACK_AVATAR_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23334155'/%3E%3Cpath d='M50 42 C61.046 42 70 50.954 70 62 L30 62 C30 50.954 38.954 42 50 42 Z' fill='white'/%3E%3Ccircle cx='50' cy='30' r='10' fill='white'/%3E%3C/svg%3E`;

interface UserFooterProps {
    profile: Profile | null;
    onSettingsClick: () => void;
    onSignOut: () => void;
    onSignIn: () => void;
    isGuest: boolean;
}

const UserFooter: React.FC<UserFooterProps> = ({ profile, onSettingsClick, onSignOut, onSignIn, isGuest }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const displayName = profile?.roblox_username || 'User';

    if (isGuest) {
        return (
            <div className="mt-auto flex-shrink-0 pt-4 pb-2 px-2 border-t border-border-color">
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xs text-gray-400 mb-2">You are in Guest Mode</p>
                    <button 
                        onClick={onSignIn} 
                        className="w-full py-2 bg-white text-black text-sm font-bold rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <UserPlusIcon className="w-4 h-4" />
                        Sign Up / Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div ref={menuRef} className="relative mt-auto flex-shrink-0 pt-2 border-t border-border-color">
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        // FIX: framer-motion props wrapped in a spread object to bypass type errors.
                        {...{
                          initial: { opacity: 0, y: 10, scale: 0.95 },
                          animate: { opacity: 1, y: 0, scale: 1 },
                          exit: { opacity: 0, y: 10, scale: 0.95 },
                          transition: { duration: 0.15, ease: 'easeOut' },
                        }}
                        className="absolute bottom-full left-0 mb-2 w-full bg-bg-tertiary/90 backdrop-blur-md border border-border-color rounded-lg shadow-2xl z-50 overflow-hidden p-1.5"
                    >
                        <button onClick={onSettingsClick} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary rounded-md hover:bg-interactive-hover hover:text-text-primary transition-colors">
                            <Cog6ToothIcon className="w-5 h-5" />
                            <span>Settings</span>
                        </button>
                        <button onClick={onSignOut} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary rounded-md hover:bg-interactive-hover hover:text-text-primary transition-colors">
                            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                            <span>Logout</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
            <button
                onClick={() => setIsMenuOpen(prev => !prev)}
                className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-lg transition-colors text-text-secondary hover:bg-interactive-hover"
            >
                <img src={profile?.avatar_url || FALLBACK_AVATAR_SVG} alt="Avatar" className="w-8 h-8 rounded-full bg-bg-tertiary" />
                <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="block truncate font-medium text-text-primary">{displayName}</span>
                        {profile?.membership === 'admin' && (
                             <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary-start/20 text-primary-start rounded uppercase tracking-wider">
                                Admin
                            </span>
                        )}
                    </div>
                     <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <SparklesIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        <span className="truncate">
                            {profile?.membership === 'admin' 
                                ? 'Unlimited Credits' 
                                : `${(profile?.credits ?? 0).toLocaleString()} Credits`}
                        </span>
                    </div>
                </div>
            </button>
        </div>
    );
};

interface LeftSidebarProps {
    id?: string;
    allChats: ChatWithProjectData[];
    activeChatId?: string;
    onSelectChat: (chat: ChatWithProjectData) => void;
    onNewChatClick: () => void;
    onUpdateChat: (chatId: string, updates: Partial<Chat>) => void;
    onDeleteChat: (chatId: string) => void;
    onSettingsClick: () => void;
    onGoToHub: () => void;
    onSignOut: () => void;
    onSignIn?: () => void;
    onSwitchMode?: () => void;
    profile: Profile | null;
    isMobileOpen: boolean;
    onMobileClose: () => void;
    workspaceMode: WorkspaceMode;
    activeProject: Project | null;
    isAdmin?: boolean;
    isPersistent?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    isGuest?: boolean;
    notificationCount?: number;
    onGoToNotifications?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ 
    id,
    allChats, activeChatId, onSelectChat, onNewChatClick,
    onUpdateChat, onDeleteChat, onSettingsClick, onGoToHub,
    onSignOut, onSignIn, onSwitchMode, profile, isMobileOpen, onMobileClose,
    workspaceMode, activeProject, isPersistent = false,
    isCollapsed = false, onToggleCollapse = () => {},
    isGuest = false, notificationCount = 0, onGoToNotifications
}) => {
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (renamingChatId && renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
    }
  }, [renamingChatId]);

  const handleRename = (chat: Chat) => {
    setRenamingChatId(chat.id);
    setRenameValue(chat.name);
  }

  const handleRenameSubmit = () => {
    if (renamingChatId && renameValue.trim()) {
        onUpdateChat(renamingChatId, { name: renameValue.trim() });
    }
    setRenamingChatId(null);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleRenameSubmit();
    } else if (e.key === 'Escape') {
        setRenamingChatId(null);
    }
  }
  
  const sidebarContent = (
    <>
        <div className="flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between">
                <button 
                    onClick={onSwitchMode} 
                    className="flex items-center gap-2 p-2 text-left w-full hover:bg-interactive-hover rounded-lg transition-colors group"
                    title={workspaceMode === 'autonomous' ? "Switch to Co-Creator Hub" : "Switch to Autonomous Mode"}
                >
                    <span className="text-xl group-hover:scale-110 transition-transform">🫧</span>
                    <h2 className="text-lg font-semibold text-text-primary truncate">Bubble AI</h2>
                </button>
                {isPersistent ? (
                    <SidebarToggleButton onToggle={onToggleCollapse} isCollapsed={isCollapsed} />
                ) : (
                    <button onClick={onMobileClose} className="p-1.5 text-text-secondary rounded-md hover:bg-interactive-hover hover:text-text-primary transition-colors md:hidden">
                        <span className="text-xl">×</span>
                    </button>
                )}
            </div>
             <button
                onClick={onNewChatClick}
                title="New Chat"
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-text-secondary hover:bg-interactive-hover"
            >
                <PlusIcon className="w-5 h-5" />
                <span>New Chat</span>
            </button>
            <button
                onClick={onGoToHub}
                title="Co-Creator Hub"
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${workspaceMode === 'cocreator' ? 'text-primary-start bg-primary-start/10' : 'text-text-secondary hover:bg-interactive-hover'}`}
            >
                <Square2StackIcon className="w-5 h-5" />
                <span>Co-Creator Hub</span>
            </button>
            {notificationCount > 0 && onGoToNotifications && (
                <button
                    onClick={onGoToNotifications}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-white bg-red-500/20 hover:bg-red-500/30"
                >
                    <BellIcon className="w-5 h-5 text-red-400" />
                    <span>Notifications</span>
                    <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{notificationCount}</span>
                </button>
            )}
             <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Search chats..."
                    className="w-full bg-bg-primary border border-border-color rounded-lg pl-10 pr-4 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-start"
                />
            </div>
        </div>
      
      <div className="flex-1 flex flex-col overflow-y-auto pr-1 mt-2">
        {workspaceMode === 'cocreator' && activeProject && (
            <div className="px-3 pt-2 pb-3 mb-2 border-b border-border-color">
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Project</p>
                <h3 className="font-semibold text-text-primary truncate mt-1">{activeProject.name}</h3>
            </div>
        )}
        {allChats.length > 0 ? (
          <div className="space-y-1">
             {allChats.map(chat => {
                const path = chat.project_id ? `/p/${chat.project_id}/c/${chat.id}` : `/c/${chat.id}`;
                const isActive = activeChatId === chat.id;
                const displayName = chat.name && chat.name.trim() !== '' ? chat.name : "New Chat";

                return (
                    <a
                        key={chat.id}
                        href={path}
                        onClick={(e) => { 
                            e.preventDefault();
                            if(renamingChatId !== chat.id) onSelectChat(chat);
                        }}
                        title={displayName}
                        // UPDATED: CSS Classes to prevent double borders
                        className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors relative group border border-transparent
                            ${isActive 
                                ? 'bg-primary-start text-white shadow-sm' 
                                : 'text-text-secondary hover:bg-interactive-hover hover:text-text-primary'
                            }
                        `}
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="block truncate pr-2 flex-1">
                                {renamingChatId === chat.id ? (
                                    <input
                                        ref={renameInputRef}
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={handleRenameSubmit}
                                        onKeyDown={handleKeyDown}
                                        className="w-full bg-transparent outline-none ring-1 ring-primary-start rounded -m-1 p-1 text-white"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                displayName
                                )}
                            </span>
                            {chat.is_group && (
                                <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] bg-white/10 text-gray-300 rounded border border-white/5 flex items-center gap-1">
                                    <UserGroupIcon className="w-3 h-3" />
                                    Group
                                </span>
                            )}
                        </div>
                        {renamingChatId !== chat.id && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center bg-inherit rounded">
                                <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRename(chat); }} className={`p-1 rounded ${isActive ? 'text-white/80 hover:text-white' : 'text-text-secondary hover:text-text-primary'}`} title="Rename">
                                    <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteChat(chat.id); }} className={`p-1 rounded ${isActive ? 'text-white/80 hover:text-red-200' : 'text-text-secondary hover:text-red-400'}`} title="Delete">
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </a>
                 )
             })}
          </div>
        ) : (
             <div className="px-3 text-sm text-center text-gray-500 mt-4">
                {workspaceMode === 'cocreator' && !activeProject
                    ? 'This user has no autonomous chats.'
                    : workspaceMode === 'cocreator'
                    ? 'No chats in this project yet.' 
                    : 'No conversations yet.'}
             </div>
        )}
      </div>

      <UserFooter 
        profile={profile}
        onSettingsClick={onSettingsClick}
        onSignOut={onSignOut}
        onSignIn={onSignIn || (() => {})}
        isGuest={isGuest}
      />
    </>
  );

  return (
    <>
      {isPersistent && (
        <motion.aside
          id={id}
          initial={false}
          animate={{ width: isCollapsed ? 0 : 260, opacity: isCollapsed ? 0 : 1 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="hidden md:flex flex-col bg-bg-secondary border-r border-border-color h-full overflow-hidden shrink-0"
        >
           <div className="flex flex-col h-full p-3 w-[260px]">
             {sidebarContent}
           </div>
        </motion.aside>
      )}

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            />
            <motion.aside
              id={id}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 w-72 bg-bg-secondary border-r border-border-color z-50 flex flex-col p-4 shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
