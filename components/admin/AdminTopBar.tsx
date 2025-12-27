
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspaceMode, Project } from '../../types';
import { 
    Bars3Icon, 
    ChevronLeftIcon, 
    ChevronDownIcon, 
    EllipsisHorizontalIcon, 
    ShareIcon, 
    UserPlusIcon, 
    ArrowDownTrayIcon, 
    TrashIcon 
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../hooks/useToast';
import { InviteFriendModal } from '../modals/InviteFriendModal';
import { UserDropdown } from '../dashboard/UserDropdown';

type AdminView = 'projects' | 'users' | 'settings' | 'personal-settings' | 'credit-system' | 'marketplace' | 'messages' | 'discover';

interface AdminTopBarProps {
    currentView: AdminView;
    setView: (view: AdminView) => void;
    workspaceMode: WorkspaceMode;
    onWorkspaceModeChange: (mode: WorkspaceMode) => void;
    onHamburgerClick: () => void;
    showHamburger: boolean;
    isThinking?: boolean;
    onSwitchToAutonomous: () => void;
    onSwitchToCocreator: () => void;
    onAccountSettingsClick: () => void;
    onSignOut: () => void;
    loadingMessage: string;
    activeProject?: Project | null;
    activeChatId?: string;
}

const FALLBACK_AVATAR_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23334155'/%3E%3Cpath d='M50 42 C61.046 42 70 50.954 70 62 L30 62 C30 50.954 38.954 42 50 42 Z' fill='white'/%3E%3Ccircle cx='50' cy='30' r='10' fill='white'/%3E%3C/svg%3E`;

export const AdminTopBar: React.FC<AdminTopBarProps> = ({ 
    currentView, 
    setView, 
    workspaceMode, 
    onWorkspaceModeChange, 
    onHamburgerClick, 
    showHamburger,
    isThinking = false,
    onSwitchToAutonomous,
    onSwitchToCocreator,
    onAccountSettingsClick,
    onSignOut,
    loadingMessage,
    activeProject,
    activeChatId
}) => {
  const { addToast } = useToast();
  const { profile } = useAuth();
  
  const [isNavOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const navItemClasses = "px-3 py-2 text-sm font-medium rounded-md transition-colors";
  const activeClasses = "bg-white/10 text-text-primary";
  const inactiveClasses = "text-text-secondary hover:bg-white/5 hover:text-text-primary";

  // Show 3-dot menu always if chat ID exists (even 'new')
  const showOptions = !!activeChatId;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setNavOpen(false);
      }
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const navItems = [
    { id: 'projects' as AdminView, label: 'Projects' },
    { id: 'users' as AdminView, label: 'Users' },
    { id: 'marketplace' as AdminView, label: 'Marketplace' },
    { id: 'messages' as AdminView, label: 'Messages' },
    { id: 'discover' as AdminView, label: 'Discover' },
    { id: 'settings' as AdminView, label: 'App Settings' },
  ];
  const currentNavItem = navItems.find(item => item.id === currentView);

  const handleInvite = () => {
      setIsInviteModalOpen(true);
      setIsOptionsMenuOpen(false);
  };

  const handleShare = () => {
      navigator.clipboard.writeText(window.location.href);
      addToast("Chat link copied to clipboard!", "success");
      setIsOptionsMenuOpen(false);
  };

  const handleExport = () => {
      addToast("Downloading chat history...", "info");
      setIsOptionsMenuOpen(false);
  };

  // Shared Header Content for consistency
  const headerContent = (
      <>
        <div className="flex items-center gap-3 md:gap-6">
            {showHamburger && (
                <button onClick={onHamburgerClick} className="p-1 text-text-secondary hover:text-text-primary" aria-label="Open menu">
                    <Bars3Icon className="w-6 h-6" />
                </button>
            )}
            
            {/* Desktop Nav (Only show in Cocreator mode) */}
            {workspaceMode === 'cocreator' && (
                <div className="hidden lg:flex items-center gap-2 p-1 bg-black/20 rounded-lg ml-4">
                    {activeProject ? (
                        <div className="flex items-center gap-4 px-2">
                            <button 
                                onClick={onSwitchToCocreator}
                                className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                                Back to Dashboard
                            </button>
                            <div className="h-4 w-px bg-white/10"></div>
                            <span className="text-sm font-semibold text-text-primary">{activeProject.name}</span>
                        </div>
                    ) : (
                        navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setView(item.id)}
                                className={`${navItemClasses} ${currentView === item.id ? activeClasses : inactiveClasses}`}
                            >
                                {item.label}
                            </button>
                        ))
                    )}
                </div>
            )}
            
            {/* Mobile Dropdown (Only show in Cocreator mode) */}
            {workspaceMode === 'cocreator' && (
                <div className="relative lg:hidden ml-auto" ref={navRef}>
                    {activeProject ? (
                        <button
                            onClick={onSwitchToCocreator}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-black/20 text-text-primary hover:bg-black/40"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                            <span>Back</span>
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setNavOpen(p => !p)}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-black/20 text-text-primary"
                            >
                                <span>{currentNavItem?.label || 'Menu'}</span>
                                <ChevronDownIcon className="w-4 h-4" />
                            </button>
                            <AnimatePresence>
                                {isNavOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute left-0 top-full mt-2 w-48 bg-bg-secondary/80 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 p-2"
                                    >
                                        {navItems.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => { setView(item.id); setNavOpen(false); }}
                                                className={`w-full text-left ${navItemClasses} ${currentView === item.id ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-white/5'}`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                </div>
            )}
        </div>

        {/* Center Status Indicator */}
        {workspaceMode === 'autonomous' && (
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-xs font-medium text-text-secondary">
                {isThinking ? (
                    <>
                        <svg className="animate-spin h-3 w-3 text-primary-start" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{loadingMessage}</span>
                    </>
                ) : (
                    <>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        <span>{loadingMessage}</span>
                    </>
                )}
            </div>
        )}

        <div className="flex items-center gap-2 md:gap-4">
            {/* Options Menu - Only shown for chats */}
            {showOptions && (
                <div className="relative" ref={optionsMenuRef}>
                    <button 
                        onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                        className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/10 rounded-full transition-colors"
                        title="Chat Options"
                    >
                        <EllipsisHorizontalIcon className="w-6 h-6" />
                    </button>
                    
                    <AnimatePresence>
                        {isOptionsMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.1 }}
                                className="absolute right-0 top-full mt-2 w-56 bg-bg-secondary/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                            >
                                <div className="p-1">
                                    <button onClick={handleInvite} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/10 rounded-lg transition-colors">
                                        <UserPlusIcon className="w-4 h-4" />
                                        <span>Bring a Friend</span>
                                    </button>
                                    <button onClick={handleShare} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/10 rounded-lg transition-colors">
                                        <ShareIcon className="w-4 h-4" />
                                        <span>Share Chat</span>
                                    </button>
                                    <button onClick={handleExport} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/10 rounded-lg transition-colors">
                                        <ArrowDownTrayIcon className="w-4 h-4" />
                                        <span>Export Data</span>
                                    </button>
                                    <div className="my-1 border-t border-white/10" />
                                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                        <TrashIcon className="w-4 h-4" />
                                        <span>Clear History</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Profile Menu - Only in Co-Creator Hub (Admin) */}
            {workspaceMode === 'cocreator' && !activeProject && (
                <div className="relative" ref={userDropdownRef}>
                    <button
                        onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                        className="flex items-center gap-2 hover:bg-white/5 p-1 rounded-full transition-colors"
                    >
                        <img 
                            src={profile?.avatar_url || FALLBACK_AVATAR_SVG} 
                            alt="Profile" 
                            className="w-8 h-8 rounded-full bg-bg-tertiary object-cover border border-white/10"
                        />
                    </button>
                    <UserDropdown 
                        isOpen={isUserDropdownOpen}
                        onClose={() => setIsUserDropdownOpen(false)}
                        onSettingsClick={onAccountSettingsClick}
                        onLogout={onSignOut}
                        onSwitchToAutonomous={onSwitchToAutonomous}
                        onSwitchToCocreator={onSwitchToCocreator}
                        isAdminView={true}
                    />
                </div>
            )}
        </div>
      </>
  );

  return (
    <>
        <header className="relative flex-shrink-0 h-16 flex items-center justify-between px-4 md:px-8 border-b border-border-color bg-bg-primary">
        {headerContent}
        </header>
        {activeChatId && (
            <InviteFriendModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                chatId={activeChatId}
            />
        )}
    </>
  );
};
