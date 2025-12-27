
import React, { useState } from 'react';
import { IdeWorkspace, IdeWorkspaceProps } from '../shared/IdeWorkspace';
import { ChatView } from '../../chat/ChatView';
import { CodeBracketIcon, ChatBubbleLeftEllipsisIcon, Cog6ToothIcon, CloudArrowDownIcon } from '@heroicons/react/24/outline';
import { useWindowSize } from '../../../hooks/useWindowSize';
import { ProjectSettingsModal } from '../../../scripts/ProjectSettingsModal';
import { useResizable } from '../../../hooks/useResizable';

const TabButton: React.FC<{ isActive: boolean; onClick: () => void; children: React.ReactNode; }> = ({ isActive, onClick, children }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            isActive
                ? 'text-white border-primary-start'
                : 'text-gray-400 border-transparent hover:text-white'
        }`}
    >
        {children}
    </button>
);

export const RobloxWorkspace: React.FC<IdeWorkspaceProps> = (props) => {
    const { width } = useWindowSize();
    const isMobile = width ? width < 1024 : false; // lg breakpoint
    const [mobileTab, setMobileTab] = useState<'chat' | 'code'>('chat');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'roblox'>('general');

    const { size: chatWidth, startResizing, isResizing } = useResizable({
        initialSize: 400,
        minSize: 300,
        maxSize: 800
    });

    const handleSaveProject = async (projectId: string, updates: any) => {
        if (props.onActiveProjectUpdate) {
            await props.onActiveProjectUpdate(updates);
        }
    };
    
    const openSettings = (tab: 'general' | 'roblox' = 'general') => {
        setSettingsInitialTab(tab);
        setIsSettingsOpen(true);
    }

    if (isMobile) {
        return (
            <div className="h-full w-full bg-bg-primary flex flex-col">
                <div className="flex-shrink-0 flex items-center justify-between border-b border-border-color bg-bg-secondary pr-2">
                    <div className="flex">
                        <TabButton isActive={mobileTab === 'chat'} onClick={() => setMobileTab('chat')}>
                            <ChatBubbleLeftEllipsisIcon className="w-5 h-5" /> Chat
                        </TabButton>
                        <TabButton isActive={mobileTab === 'code'} onClick={() => setMobileTab('code')}>
                            <CodeBracketIcon className="w-5 h-5" /> Code
                        </TabButton>
                    </div>
                    <button onClick={() => openSettings('general')} className="p-2 text-gray-400 hover:text-white">
                        <Cog6ToothIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    {mobileTab === 'chat' && <ChatView {...props} />}
                    {mobileTab === 'code' && <IdeWorkspace {...props} />}
                </div>
                <ProjectSettingsModal 
                    isOpen={isSettingsOpen} 
                    onClose={() => setIsSettingsOpen(false)} 
                    project={props.project}
                    onSave={handleSaveProject}
                    initialTab={settingsInitialTab}
                />
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-transparent text-white relative">
            {/* Toolbar for Desktop */}
            <div className="absolute top-2 right-4 z-20 flex gap-2">
                 <button 
                    onClick={() => openSettings('roblox')} 
                    className="p-2 bg-bg-secondary/80 backdrop-blur border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 text-xs font-medium"
                    title="Manage Sync Plugin"
                >
                    <CloudArrowDownIcon className="w-4 h-4" />
                    <span>Plugin Config</span>
                </button>
                <button 
                    onClick={() => openSettings('general')} 
                    className="p-2 bg-bg-secondary/80 backdrop-blur border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Project Settings"
                >
                    <Cog6ToothIcon className="w-5 h-5" />
                </button>
            </div>

            <div 
                className="grid h-full w-full bg-bg-primary" 
                style={{ 
                    gridTemplateColumns: `${chatWidth}px 8px 1fr`,
                    userSelect: isResizing ? 'none' : 'auto'
                }}
            >
                <div className="h-full bg-bg-secondary overflow-hidden">
                    <ChatView {...props} />
                </div>
                
                <div 
                    className="h-full bg-bg-tertiary cursor-col-resize hover:bg-primary-start/50 transition-colors"
                    onMouseDown={startResizing}
                />
                
                <div className="h-full overflow-hidden pt-1">
                    <IdeWorkspace {...props} />
                </div>
            </div>
            
            <ProjectSettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                project={props.project}
                onSave={handleSaveProject}
                initialTab={settingsInitialTab}
            />
        </div>
    );
};
