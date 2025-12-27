
import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, Cog6ToothIcon, Bars3Icon, BuildingStorefrontIcon, ChatBubbleBottomCenterTextIcon, UsersIcon } from '@heroicons/react/24/outline';
import { 
    ShareIcon, 
    UserPlusIcon, 
    ArrowDownTrayIcon, 
    EllipsisHorizontalIcon, 
    TrashIcon,
    LinkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspaceMode } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../hooks/useToast';
import { InviteFriendModal } from '../modals/InviteFriendModal';
import { UserDropdown } from './UserDropdown';

type HubView = 'projects' | 'marketplace' | 'messages' | 'discover';

interface TopBarProps {
  onGoToHub: () => void;
  onAccountSettingsClick: () => void;
  onProjectSettingsClick: () => void;
  onLogout: () => void;
  activeProjectName: string | null;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  isProjectView: boolean;
  onHamburgerClick: () => void;
  showHamburger: boolean;
  isThinking?: boolean;
  onSwitchToAutonomous: () => void;
  onSwitchToCocreator: () => void;
  hubView: HubView;
  onHubViewChange: (view: HubView) => void;
  loadingMessage: string;
  hamburgerId?: string;
  chatId?: string;
}

const FALLBACK_AVATAR_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23334155'/%3E%3Cpath d='M50 42 C61.046 42 70 50.954 70 62 L30 62 C30 50.954 38.954 42 50 42 Z' fill='white'/%3E%3Ccircle cx='50' cy='30' r='10' fill='white'/%3E%3C/svg%3E`;

// Dummy CubeIcon for HubNavigation
const CubeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9.75v9.75" />
    </svg>
);

const HubNavigation: React.FC<{ hubView: HubView, onHubViewChange: (view: HubView) => void }> = ({ hubView, onHubViewChange }) => {
    const navItems = [
        { id: 'projects' as HubView, label: 'My Projects', icon: <CubeIcon className="w-5 h-5" /> },
        { id: 'marketplace' as HubView, label: 'Marketplace', icon: <BuildingStorefrontIcon className="w-5 h-5" /> },
        { id: 'messages' as HubView, label: 'Messages', icon: <ChatBubbleBottomCenterTextIcon className="w-5 h-5" /> },
        { id: 'discover' as HubView, label: 'Discover', icon: <UsersIcon className="w-5 h-5" /> },
    ];
    
    return (
        <div className="flex items-center gap-2 p-1 bg-black/20 rounded-lg">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => onHubViewChange(item.id)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${hubView === item.id ? 'bg-interactive-hover text-text-primary' : 'text-text-secondary hover:bg-interactive-hover hover:text-text-primary'}`}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
};

export const TopBar: React.FC<TopBarProps> = ({ 
    onGoToHub, 
    onAccountSettingsClick, 
    onProjectSettingsClick,
    onLogout,
    activeProjectName,
    searchQuery,
    onSearchQueryChange,
    workspaceMode,
    onWorkspaceModeChange,
    isProjectView,
    onHamburgerClick,
    showHamburger,
    isThinking = false,
    onSwitchToAutonomous,
    onSwitchToCocreator,
    hubView,
    onHubViewChange,
    loadingMessage,
    hamburgerId,
    chatId
}) => {
  const { addToast } = useToast();
  const { profile } = useAuth();
  
  const [isHubDropdownOpen, setHubDropdownOpen] = useState(false);
  const hubDropdownRef = useRef<HTMLDivElement>(null);
  
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  // Show 3-dot menu always if we are in a chat view (chatId present, even if 'new')
  const showOptions = !!chatId;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hubDropdownRef.current && !hubDropdownRef.current.contains(event.target as Node)) {
        setHubDropdownOpen(false);
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
  
    const hubNavItems = [
        { id: 'projects' as HubView, label: 'My Projects', icon: <CubeIcon className="w-5 h-5" /> },
        { id: 'marketplace' as HubView, label: 'Marketplace', icon: <BuildingStorefrontIcon className="w-5 h-5" /> },
        { id: 'messages' as HubView, label: 'Messages', icon: <ChatBubbleBottomCenterTextIcon className="w-5 h-5" /> },
        { id: 'discover' as HubView, label: 'Discover', icon: <UsersIcon className="w-5 h-5" /> },
    ];
    
    const currentHubItem = hubNavItems.find(item => item.id === hubView);

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

  return (
    <>
        <header className="relative flex-shrink-0 h-14 md:h-16 flex items-center justify-between px-3 md:px-8 bg-bg-primary/50 backdrop-blur-sm border-b border-transparent md:border-none z-20">
        <div className="flex items-center gap-2 md:gap-4 flex-shrink min-w-0 flex-1">
            {showHamburger && (
                <button id={hamburgerId} onClick={onHamburgerClick} className="p-1.5 text-text-secondary hover:text-text-primary rounded-md hover:bg-white/5" aria-label="Open menu">
                    <Bars3Icon className="w-6 h-6" />
                </button>
            )}
            
            {!isProjectView && workspaceMode === 'cocreator' && (
                <>
                {/* Desktop Hub Nav */}
                <div className="hidden lg:block">
                    <HubNavigation hubView={hubView} onHubViewChange={onHubViewChange} />
                </div>
                {/* Mobile Hub Dropdown */}
                <div className="relative lg:hidden ml-0" ref={hubDropdownRef}>
                    <button
                        onClick={() => setHubDropdownOpen(p => !p)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-bg-tertiary text-text-primary"
                    >
                        {currentHubItem?.icon}
                        <span className="hidden sm:inline">{currentHubItem?.label}</span>
                        <ChevronDownIcon className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                        {isHubDropdownOpen && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute left-0 top-full mt-2 w-56 bg-bg-secondary/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 p-2"
                            >
                                {hubNavItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => { onHubViewChange(item.id); setHubDropdownOpen(false); }}
                                        className={`w-full flex items-center gap-3 p-2 text-left rounded-md transition-colors ${hubView === item.id ? 'bg-interactive-hover text-text-primary' : 'text-text-secondary hover:bg-interactive-hover'}`}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                </>
            )}
            
            {isProjectView && activeProjectName && (
                <>
                    {/* Project Title - Visible on Mobile now */}
                    <div className="flex items-center gap-2 min-w-0 max-w-full">
                        <span className="font-semibold text-text-primary truncate text-sm md:text-base">{activeProjectName}</span>
                        <button 
                            onClick={onProjectSettingsClick} 
                            className="p-1.5 text-text-secondary rounded-md hover:bg-interactive-hover hover:text-text-primary transition-colors flex-shrink-0"
                            title="Project Settings"
                        >
                            <Cog6ToothIcon className="w-5 h-5" />
                        </button>
                    </div>
                </>
            )}
        </div>

        {/* Center Status Indicator - HIGH VISIBILITY FIX FOR MOBILE */}
        {workspaceMode === 'autonomous' && (
            <div className={`fixed md:absolute top-16 md:top-1/2 left-1/2 -translate-x-1/2 md:-translate-y-1/2 flex items-center gap-2 text-xs font-medium text-gray-400 z-30 pointer-events-none md:mt-0 mt-2`}>
                {isThinking ? (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 px-4 py-2 bg-black/90 backdrop-blur-xl rounded-full border border-primary-start/50 text-primary-start shadow-2xl ring-2 ring-primary-start/20"
                    >
                        <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="font-semibold">{loadingMessage}</span>
                    </motion.div>
                ) : (
                    // Always show "Ready" pill with solid background for visibility
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/80 backdrop-blur-md border border-white/10 shadow-lg">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <span className="text-xs font-medium text-gray-200">Ready</span>
                    </div>
                )}
            </div>
        )}

        <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
            {/* Options Menu - Only shown for chats */}
            {showOptions && (
                <div className="relative" ref={optionsMenuRef}>
                    <button 
                        onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
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
                                    <button onClick={handleInvite} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                        <UserPlusIcon className="w-4 h-4" />
                                        <span>Bring a Friend</span>
                                    </button>
                                    <button onClick={handleShare} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                        <ShareIcon className="w-4 h-4" />
                                        <span>Share Chat</span>
                                    </button>
                                    <button onClick={handleExport} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
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

            {/* Profile Menu - Only in Co-Creator Hub */}
            {!isProjectView && workspaceMode === 'cocreator' && (
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
                        onLogout={onLogout}
                        onSwitchToAutonomous={onSwitchToAutonomous}
                        onSwitchToCocreator={onSwitchToCocreator}
                    />
                </div>
            )}
        </div>
        </header>
        {chatId && (
            <InviteFriendModal 
                isOpen={isInviteModalOpen} 
                onClose={() => setIsInviteModalOpen(false)} 
                chatId={chatId} 
            />
        )}
    </>
  );
};
