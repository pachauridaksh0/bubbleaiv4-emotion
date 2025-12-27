
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LeftSidebar } from './LeftSidebar';
import { ChatView } from '../chat/ChatView';
import { ProjectsPage } from '../pages/ProjectsPage';
import { TopBar } from '../dashboard/TopBar';
import { Project, Message, Chat, WorkspaceMode, ProjectPlatform, ProjectType, ChatWithProjectData } from '../../types';
import { SettingsPage } from '../pages/SettingsPage';
import { useAuth } from '../../contexts/AuthContext';
import { updateProject as updateDbProject, createProject, createChat as createDbChat, getAllChatsForUser, getChatsForProject, getNotifications, getPendingFriendRequests } from '../../services/databaseService';
import { localChatService } from '../../services/localChatService';
import { StatusBar } from '../admin/ImpersonationBanner';
import { CoCreatorWorkspace } from '../cocreator/CoCreatorWorkspace';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { generateProjectDetails, classifyUserIntent } from '../../services/geminiService';
import { useToast } from '../../hooks/useToast';
import { useChat } from '../../hooks/useChat';
import { useWindowSize } from '../../hooks/useWindowSize';
import { AuthOverlay } from '../auth/AuthOverlay';
import AuroraCanvas from '../ui/AuroraCanvas';
import { ProjectSettingsModal } from '../../scripts/ProjectSettingsModal';

import { MarketplacePage } from '../community/MarketplacePage';
import { MessagesPage } from '../community/MessagesPage';
import { DiscoverPage } from '../community/DiscoverPage';

type View = 'chat' | 'settings';
type HubView = 'projects' | 'marketplace' | 'messages' | 'discover';

interface LayoutProps {
  geminiApiKey: string;
}

export const Layout: React.FC<LayoutProps> = ({ geminiApiKey }) => {
  const { user, supabase, isImpersonating, profile, isAdmin, signOut, stopImpersonating, isGuest } = useAuth();
  const { addToast } = useToast();
  
  const [pathname, setPathname] = useState(window.location.pathname);
  const [workspaceMode, setWorkspaceMode] = useLocalStorage<WorkspaceMode>('workspaceMode', 'autonomous');
  const [lastActivePath, setLastActivePath] = useLocalStorage<string | null>('lastActivePath', null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchResultIndex, setCurrentSearchResultIndex] = useState(-1);

  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage('userSidebarCollapsed', false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthOverlayOpen, setIsAuthOverlayOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Project Settings Modal State
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);

  // --- File Build Status State ---
  const [writingFile, setWritingFile] = useState<string | null>(null);
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(new Set());

  const {
      allChats,
      setAllChats,
      activeChat,
      setActiveChat,
      messages,
      setMessages,
      isLoading,
      isSending,
      isCreatingChat,
      setIsCreatingChat,
      activeProject,
      handleUpdateChat,
      handleDeleteChat,
      handleSendMessage,
      handleStopGeneration,
  } = useChat({ user, geminiApiKey, workspaceMode });

  // Fetch notification count periodically
  useEffect(() => {
      if (!user || isGuest) return;
      
      const fetchCount = async () => {
          try {
              const notes = await getNotifications(supabase, user.id);
              const unreadNotes = notes.filter(n => !n.read).length;
              const requests = await getPendingFriendRequests(supabase, user.id);
              setNotificationCount(unreadNotes + requests.length);
          } catch (e) {
              console.error("Failed to fetch notification count", e);
          }
      };

      fetchCount();
      const interval = setInterval(fetchCount, 30000); // Check every 30s
      return () => clearInterval(interval);
  }, [user, isGuest, supabase]);

  useEffect(() => {
      if (window.location.pathname !== pathname) {
          setPathname(window.location.pathname);
      }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
        if (window.location.pathname !== pathname) {
            setPathname(window.location.pathname);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [pathname]);

  useEffect(() => {
      if (pathname !== '/' && !pathname.includes('/c/new')) {
          setLastActivePath(pathname);
      }
  }, [pathname, setLastActivePath]);

  const navigate = useCallback((path: string, replace: boolean = false) => {
    setPathname(path);
    setIsSidebarOpen(false); 

    try {
      if (replace) {
        window.history.replaceState({}, '', path);
      } else {
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
        }
      }
    } catch (e) {
    }
  }, []);

  const { view, hubView, chatId, isRoot } = useMemo(() => {
    const cleanPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    if (cleanPath === '/') return { view: 'root', isRoot: true };
    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length === 0) return { view: 'root', isRoot: true };
    if (parts[0] === 'settings') return { view: 'settings' };
    if (parts[0] === 'autonomous-chat') return { view: 'chat', chatId: 'new' };
    if (parts[0] === 'cocreator-hub') return { view: 'chat', hubView: 'projects' };
    if (parts[0] === 'projects') return { view: 'chat', hubView: 'projects' };
    if (parts[0] === 'marketplace') return { view: 'chat', hubView: 'marketplace' };
    if (parts[0] === 'messages') return { view: 'chat', hubView: 'messages' };
    if (parts[0] === 'discover') return { view: 'chat', hubView: 'discover' };
    if (parts[0] === 'c') return { view: 'chat', chatId: parts[1] };
    if (parts[0] === 'p' && parts.length >= 3 && parts[2] === 'c') {
      return { view: 'chat', chatId: parts[3] };
    }
    return { view: 'root', isRoot: true };
  }, [pathname]);

  useEffect(() => {
    if (isRoot) {
        if (lastActivePath && lastActivePath !== '/' && !lastActivePath.includes('new')) {
            navigate(lastActivePath, true);
            return;
        }
        if (workspaceMode === 'autonomous') {
            navigate('/autonomous-chat', true);
        } else {
            navigate('/projects', true);
        }
        return;
    }
    if (chatId === 'new') {
        setWorkspaceMode('autonomous');
        setActiveChat(null);
    } else if (hubView) {
        setWorkspaceMode('cocreator');
        setActiveChat(null);
    } else if (chatId) {
      const chatToSelect = allChats.find(c => c.id === chatId);
      if (chatToSelect && chatToSelect.id !== activeChat?.id) {
        setActiveChat(chatToSelect);
        // Correctly set mode based on whether chat has a project
        setWorkspaceMode(chatToSelect.project_id ? 'cocreator' : 'autonomous');
      }
    } else if (view === 'settings') {
      // Explicitly clear active chat when in settings to prevent confusing state
      if (activeChat) setActiveChat(null);
    }
  }, [view, hubView, chatId, isRoot, allChats, activeChat?.id, setActiveChat, setWorkspaceMode, navigate, workspaceMode, lastActivePath]);

  const isThinking = isLoading || isCreatingChat;
  const [loadingMessage, setLoadingMessage] = useState('Bubble is ready');
  const loadingTexts = useMemo(() => [
    "Thinking...", "Analyzing request...", "Consulting memory...", 
    "Formulating plan...", "Generating code...", "Adapting to updates..."
  ], []);

  useEffect(() => {
    let intervalId: number | undefined;
    if (isThinking) {
        let currentIndex = 0;
        setLoadingMessage(loadingTexts[currentIndex]);
        intervalId = window.setInterval(() => {
            currentIndex = (currentIndex + 1) % loadingTexts.length;
            setLoadingMessage(loadingTexts[currentIndex]);
        }, 2500);
    } else {
        setLoadingMessage('Bubble is ready');
    }
    return () => {
        if (intervalId) window.clearInterval(intervalId);
    };
  }, [isThinking, loadingTexts]);
  
  const handleLogoutAction = () => {
      setLastActivePath(null);
      if (isImpersonating) stopImpersonating();
      else signOut();
  };

  const autonomousChats = useMemo(() => allChats.filter(c => !c.project_id), [allChats]);
  const chatsForSidebar = useMemo(() => {
    if (workspaceMode === 'cocreator') {
        return activeProject ? allChats.filter(c => c.project_id === activeProject.id) : autonomousChats;
    }
    return autonomousChats;
  }, [allChats, workspaceMode, activeProject, autonomousChats]);
  
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        const sidebar = document.getElementById('left-sidebar');
        const hamburger = document.getElementById('hamburger-button');
        const isTransient = workspaceMode === 'cocreator' || isMobile;
        if (isTransient && isSidebarOpen && sidebar && !sidebar.contains(e.target as Node) && !hamburger?.contains(e.target as Node)) {
            closeSidebar();
        }
    };
    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isSidebarOpen) closeSidebar();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEsc);
    }
  }, [isSidebarOpen, workspaceMode, isMobile]);

  const handleNewCoCreatorChat = async () => {
    if (isGuest) { setIsAuthOverlayOpen(true); return; }
    if (!activeProject) return;
    setIsCreatingChat(true);
    try {
        const projectChats = allChats.filter(c => c.project_id === activeProject.id);
        const newChatName = `New Chat ${projectChats.length + 1}`;
        let newChat: Chat;
        if (!user || !supabase) return;
        newChat = await createDbChat(supabase, user.id, newChatName, 'build', activeProject.id);
        const newChatWithProjectData: ChatWithProjectData = { ...newChat, projects: activeProject };
        setAllChats(prev => [newChatWithProjectData, ...prev]);
        navigate(`/p/${activeProject.id}/c/${newChat.id}`);
    } catch (error) {
        console.error(error);
        addToast('Failed to create a new chat in this project.', 'error');
    } finally {
        setIsCreatingChat(false);
    }
  };

  const handleHamburgerClick = () => {
    const isPersistentNonMobile = workspaceMode === 'autonomous' && !isMobile;
    if (isPersistentNonMobile) {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    } else {
        toggleSidebar();
    }
  };

  const handleSelectProjectFromHub = async (project: Project) => {
      if (isGuest) { setIsAuthOverlayOpen(true); return; }
      try {
          if (!supabase) return;
          const projectChats = await getChatsForProject(supabase, project.id);
          
          const mostRecentChat = projectChats.sort((a, b) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )[0];
          
          if (mostRecentChat) {
              const chatWithProject = { ...mostRecentChat, projects: project };
              setActiveChat(chatWithProject);
              navigate(`/p/${project.id}/c/${mostRecentChat.id}`);
          } else {
              if (!supabase || !user) return;
              const newChat = await createDbChat(supabase, user.id, `Main Chat`, 'build', project.id);
              const newChatWithProject: ChatWithProjectData = { ...newChat, projects: project };
              setAllChats(prev => [newChatWithProject, ...prev]);
              setActiveChat(newChatWithProject);
              navigate(`/p/${project.id}/c/${newChat.id}`);
          }
      } catch (e) {
          console.error("Error selecting project:", e);
          addToast("Failed to open project.", "error");
      }
  };

  const handleCreateCoCreatorProject = async (name: string, platform: ProjectPlatform, projectType: ProjectType): Promise<void> => {
    if (isGuest) { setIsAuthOverlayOpen(true); return; }
    setIsCreatingChat(true);
    try {
        if (!user || !supabase) return;
        const newProject = await createProject(supabase, user.id, name, platform, projectType);
        addToast(`Created new project: ${name}!`, "success");
        await handleSelectProjectFromHub(newProject);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        addToast(`Failed to create project: ${errorMessage}`, "error");
    } finally {
        setIsCreatingChat(false);
    }
  };

  const createProjectFromPrompt = async (prompt: string): Promise<void> => {
    if (isGuest) { setIsAuthOverlayOpen(true); return; }
    if (!user || !geminiApiKey) return;
    setIsCreatingChat(true);
    try {
      const details = await generateProjectDetails(prompt, geminiApiKey);
      const { name, description, project_type } = details;
      const platform = project_type === 'roblox_game' ? 'Roblox Studio' : 'Web App';
      
      if (!supabase || !user) return;
      const newProject = await createProject(supabase, user.id, name, platform, project_type, description);
      const newChat = await createDbChat(supabase, user.id, name, 'build', newProject.id);
      
      const newChatWithProject: ChatWithProjectData = { ...newChat, projects: newProject };

      addToast(`Created new project: ${name}!`, "success");
      setAllChats(prev => [newChatWithProject, ...prev]);
      
      const newPath = `/p/${newProject.id}/c/${newChat.id}`;
      navigate(newPath, true);
      
      setActiveChat(newChatWithProject);
      setWorkspaceMode('cocreator');
      
      const { projectUpdate } = await handleSendMessage(prompt, null, newChatWithProject);

      if (projectUpdate && newChatWithProject.project_id) {
          if(supabase) await updateDbProject(supabase, newChatWithProject.project_id, projectUpdate);
      }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        addToast(`Failed to create project: ${errorMessage}`, "error");
    } finally {
        setIsCreatingChat(false);
    }
  };

  // UPDATED: Now accepts optional chat and model override to match IdeWorkspaceProps signature
  const handleFirstMessage = async (prompt: string, files: File[] | null = null, chat?: ChatWithProjectData | null, modelOverride?: string) => {
    setIsCreatingChat(true);
    try {
      if (chatId === 'new' && workspaceMode === 'autonomous') {
        let newChat: Chat;
        if (isGuest) {
            newChat = await localChatService.createChat(prompt, 'chat');
        } else {
            if (!user || !supabase) return;
            newChat = await createDbChat(supabase, user.id, prompt, 'chat', null);
        }
        
        const newChatWithProject: ChatWithProjectData = { ...newChat, projects: null };
        setAllChats(prev => [newChatWithProject, ...prev]);

        const newPath = `/c/${newChat.id}`;
        navigate(newPath, true);
        
        setActiveChat(newChatWithProject);
        
        // Pass the mode down correctly
        await handleSendMessage(prompt, files, newChatWithProject, modelOverride);
      } else {
        if (geminiApiKey) {
            const { intent } = await classifyUserIntent(prompt, geminiApiKey);
            if (intent === 'creative_request') {
              await createProjectFromPrompt(prompt);
            } else {
              addToast("To start a conversation, please switch to Autonomous Mode.", "info");
            }
        } else if (isGuest) {
             if (workspaceMode === 'autonomous') {
                 let newChat = await localChatService.createChat(prompt, 'chat');
                 const newChatWithProject = { ...newChat, projects: null };
                 setAllChats(prev => [newChatWithProject, ...prev]);
                 navigate(`/c/${newChat.id}`, true);
                 setActiveChat(newChatWithProject);
                 // Pass the mode down correctly
                 await handleSendMessage(prompt, files, newChatWithProject, modelOverride);
             } else {
                 setIsAuthOverlayOpen(true);
             }
        }
      }
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "Could not start your new chat.";
       addToast(errorMessage, "error");
    } finally {
       setIsCreatingChat(false);
    }
  };
  
  // CORE FILE UPDATE HANDLER
  const handleProjectFileUpdate = (path: string, content: string, isComplete: boolean) => {
      // 1. Update State for Visual Feedback
      if (!isComplete) {
          setWritingFile(path);
      } else {
          setWritingFile(null);
          setCompletedFiles(prev => {
              const next = new Set(prev);
              next.add(path);
              return next;
          });
          // Cleanup completed status after 5s
          setTimeout(() => {
              setCompletedFiles(prev => {
                  const next = new Set(prev);
                  next.delete(path);
                  return next;
              });
          }, 5000);
      }

      // 2. Update Actual Project Data
      if (!activeProject) return;
      const updatedFiles = { ...(activeProject.files || {}), [path]: { content } };
      const updatedProject = { ...activeProject, files: updatedFiles };
      
      setAllChats(prev => prev.map(c => {
          if (c.project_id === activeProject.id && c.projects) {
              return { ...c, projects: { ...c.projects, ...updatedProject } };
          }
          return c;
      }));
      if (activeChat?.project_id === activeProject.id) {
          setActiveChat(prev => prev ? { ...prev, projects: { ...prev.projects!, ...updatedProject } } : prev);
      }
  }

  const handleLocalSendMessage = async (text: string, files: File[] | null = null, chat?: ChatWithProjectData | null, modelOverride?: string) => {
      try {
          const { projectUpdate } = await handleSendMessage(text, files, chat, modelOverride, handleProjectFileUpdate);
          if (projectUpdate && activeProject) {
               if (isGuest) {
                   // Guests handled by local service in hook
               } else if (supabase) await updateDbProject(supabase, activeProject.id, projectUpdate);
          }
      } catch (e) {
          console.error("Error sending message:", e);
          addToast("Failed to send message", "error");
      }
  }
  
  const handleSaveProjectSettings = async (projectId: string, updates: Partial<Project>) => {
      if (activeProject && activeProject.id === projectId) {
          if (supabase && !isGuest) {
              await updateDbProject(supabase, projectId, updates);
              // Optimistic update
              const updated = { ...activeProject, ...updates };
              setActiveChat(prev => prev ? { ...prev, projects: updated } : prev);
              setAllChats(prev => prev.map(c => c.project_id === projectId && c.projects ? { ...c, projects: { ...c.projects, ...updates } as any } : c));
              addToast("Project settings saved.", "success");
          }
      }
  };

  const renderMainContent = () => {
    try {
        if (view === 'settings') return <SettingsPage onBack={() => navigate('/projects')} />;
        if (workspaceMode === 'cocreator') {
            if (!activeProject) {
                switch (hubView) {
                    case 'marketplace': return <MarketplacePage />;
                    case 'messages': return <MessagesPage onNavigate={navigate} />;
                    case 'discover': return <DiscoverPage />;
                    case 'projects':
                    default:
                        if (isGuest) {
                             return <ProjectsPage profile={profile} onSelectProject={handleSelectProjectFromHub} projects={[]} onCreateCoCreatorProject={handleCreateCoCreatorProject} onCreateAutonomousProject={createProjectFromPrompt} />;
                        }
                        const projectsForHub = allChats
                            .map(c => c.projects)
                            .filter((p): p is Project => !!p)
                            .reduce((acc, current) => {
                                if (!acc.find(item => item.id === current.id)) acc.push(current);
                                return acc;
                            }, [] as Project[]);
                        return (
                            <ProjectsPage
                                profile={profile}
                                onSelectProject={handleSelectProjectFromHub}
                                projects={projectsForHub}
                                onCreateCoCreatorProject={handleCreateCoCreatorProject}
                                onCreateAutonomousProject={createProjectFromPrompt}
                            />
                        );
                }
            }
            return (
                <CoCreatorWorkspace
                    project={activeProject}
                    chat={activeChat}
                    geminiApiKey={geminiApiKey!}
                    messages={messages}
                    isLoadingHistory={isLoading}
                    isSending={isSending}
                    isCreatingChat={isCreatingChat}
                    setMessages={setMessages}
                    onSendMessage={activeChat ? handleLocalSendMessage : handleFirstMessage}
                    onChatUpdate={(updates) => activeChat && handleUpdateChat(activeChat.id, updates)}
                    onActiveProjectUpdate={async (updates) => {
                        if (activeProject && supabase && !isGuest) {
                            await updateDbProject(supabase, activeProject.id, updates);
                        }
                    }}
                    searchQuery={searchQuery}
                    onSearchResultsChange={setSearchResults}
                    currentSearchResultMessageIndex={currentSearchResultIndex}
                    isAdmin={!!isAdmin}
                    workspaceMode={workspaceMode}
                    projectType={activeProject.project_type === 'website' ? 'website' : 'roblox_game'}
                    loadingMessage={loadingMessage}
                    onStop={handleStopGeneration}
                    // Pass status props
                    writingFile={writingFile}
                    completedFiles={completedFiles}
                />
            );
        }
        return (
            <ChatView
                key={activeChat?.id || 'autonomous-new-chat'}
                project={activeProject}
                chat={activeChat}
                geminiApiKey={geminiApiKey!}
                messages={messages}
                isLoadingHistory={isLoading}
                isSending={isSending}
                isCreatingChat={isCreatingChat}
                setMessages={setMessages}
                // Updated to handle 3 args for new chat creation
                onSendMessage={(text, files, _, modelOverride) => {
                    if (activeChat) handleLocalSendMessage(text, files, activeChat, modelOverride);
                    else handleFirstMessage(text, files, null, modelOverride);
                }}
                onChatUpdate={(updates) => activeChat && handleUpdateChat(activeChat.id, updates)}
                onActiveProjectUpdate={null}
                searchQuery={searchQuery}
                onSearchResultsChange={setSearchResults}
                currentSearchResultMessageIndex={currentSearchResultIndex}
                isAdmin={!!isAdmin}
                workspaceMode={workspaceMode}
                loadingMessage={loadingMessage}
                onStop={handleStopGeneration}
                onRequireAuth={() => setIsAuthOverlayOpen(true)}
            />
        );
    } catch (error) {
        console.error("Render error in main content:", error);
        return <div className="p-8 text-center text-red-400">An error occurred while rendering the application content. Please refresh.</div>;
    }
  };
  
  const handleNewChatClick = () => {
    if (workspaceMode === 'cocreator' && activeProject) handleNewCoCreatorChat();
    else navigate('/autonomous-chat');
  };

  const handleSelectChatFromSidebar = (chat: ChatWithProjectData) => {
    const path = chat.project_id ? `/p/${chat.project_id}/c/${chat.id}` : `/c/${chat.id}`;
    // Force immediate state update for Co-Creator chat selection to ensure
    // correct context even before navigation completes.
    if (chat.project_id) {
        // Ensure we are in cocreator mode
        setWorkspaceMode('cocreator');
        // Set active chat immediately so UI updates
        setActiveChat(chat);
    } else {
        setWorkspaceMode('autonomous');
        setActiveChat(chat);
    }
    navigate(path);
  };

  const handleToggleMode = () => {
      if (workspaceMode === 'autonomous') {
          navigate('/cocreator-hub');
      } else {
          navigate('/autonomous-chat');
      }
  };

  return (
    <div className="relative flex flex-col h-screen w-full font-sans text-text-primary bg-bg-primary overflow-hidden">
      {/* Aurora Background for App (Subtler than Welcome Page) */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
          <AuroraCanvas />
      </div>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-transparent via-bg-primary/90 to-bg-primary pointer-events-none" />

      <StatusBar />
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* HIDE SIDEBAR ON SETTINGS PAGE */}
        {view !== 'settings' && (
            <LeftSidebar
              id="left-sidebar"
              allChats={chatsForSidebar}
              activeChatId={activeChat?.id}
              onSelectChat={handleSelectChatFromSidebar}
              onNewChatClick={handleNewChatClick}
              onUpdateChat={handleUpdateChat}
              onDeleteChat={handleDeleteChat}
              onSettingsClick={() => navigate('/settings')}
              onGoToHub={() => navigate('/cocreator-hub')}
              onSignOut={handleLogoutAction}
              onSignIn={() => setIsAuthOverlayOpen(true)}
              onSwitchMode={handleToggleMode}
              profile={profile}
              isMobileOpen={isSidebarOpen}
              onMobileClose={closeSidebar}
              workspaceMode={workspaceMode}
              isAdmin={isAdmin}
              activeProject={activeProject}
              isPersistent={workspaceMode === 'autonomous' && !isMobile}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
              isGuest={!!isGuest}
              notificationCount={notificationCount}
              onGoToNotifications={() => { navigate('/messages'); setWorkspaceMode('cocreator'); }}
            />
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          {view !== 'settings' && (
              <TopBar
                onGoToHub={() => navigate('/cocreator-hub')}
                onAccountSettingsClick={() => navigate('/settings')}
                onProjectSettingsClick={() => setIsProjectSettingsOpen(true)}
                onLogout={handleLogoutAction}
                activeProjectName={activeProject?.name ?? null}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                workspaceMode={workspaceMode}
                onWorkspaceModeChange={(mode) => setWorkspaceMode(mode)}
                isProjectView={!!activeProject}
                onHamburgerClick={handleHamburgerClick}
                showHamburger={isMobile || workspaceMode === 'cocreator' || (workspaceMode === 'autonomous' && isSidebarCollapsed)}
                isThinking={isThinking}
                onSwitchToAutonomous={() => navigate('/autonomous-chat')}
                onSwitchToCocreator={() => navigate('/cocreator-hub')}
                hubView={hubView as HubView}
                onHubViewChange={(newHubView) => navigate(`/${newHubView}`)}
                loadingMessage={loadingMessage}
                hamburgerId="hamburger-button"
                chatId={chatId}
              />
          )}
          <main className="flex-1 overflow-y-auto px-2 md:px-0">
            {renderMainContent()}
          </main>
        </div>
      </div>
      <AuthOverlay isOpen={isAuthOverlayOpen} onClose={() => setIsAuthOverlayOpen(false)} />
      
      {/* Project Settings Modal */}
      <ProjectSettingsModal 
          isOpen={isProjectSettingsOpen} 
          onClose={() => setIsProjectSettingsOpen(false)} 
          project={activeProject}
          onSave={handleSaveProjectSettings}
      />
    </div>
  );
};