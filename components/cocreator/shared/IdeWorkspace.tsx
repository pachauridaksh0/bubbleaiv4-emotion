
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { FileExplorer } from './FileExplorer';
import { Message, Project, Chat, WorkspaceMode, ChatWithProjectData } from '../../../types';
import { useCollaborativeCursors } from '../../../hooks/useCollaborativeCursors';
import { motion } from 'framer-motion';
import { useResizable } from '../../../hooks/useResizable';

export interface IdeWorkspaceProps {
  project: Project;
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
  projectType: 'website' | 'roblox_game';
  loadingMessage: string;
  onStop?: () => void;
  onFixError?: (error: string) => void;
  // New props for build status
  writingFile?: string | null;
  completedFiles?: Set<string>;
}

const Cursor: React.FC<{ x: number; y: number; color: string; label: string }> = ({ x, y, color, label }) => (
    <motion.div
        className="absolute pointer-events-none z-50"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ left: `${x}%`, top: `${y}%`, opacity: 1, scale: 1 }}
        transition={{ duration: 0.1, ease: "linear" }}
    >
        <svg
            className="w-5 h-5 drop-shadow-md"
            viewBox="0 0 24 24"
            fill={color}
            xmlns="http://www.w3.org/2000/svg"
            style={{ transform: 'rotate(-15deg) translate(-2px, -2px)' }}
        >
            <path d="M5.5 3.2L18.8 9.5L12.5 12.8L15.8 19.1L5.5 3.2Z" stroke="white" strokeWidth="1.5" />
        </svg>
        <div 
            className="absolute left-4 top-4 px-2 py-0.5 rounded text-xs font-bold text-white whitespace-nowrap shadow-sm"
            style={{ backgroundColor: color }}
        >
            {label}
        </div>
    </motion.div>
);

export const IdeWorkspace: React.FC<IdeWorkspaceProps> = (props) => {
    const { projectType, project, onActiveProjectUpdate, writingFile, completedFiles } = props;
    
    // LIVE COLLAB HOOK
    const { cursors, containerRef } = useCollaborativeCursors(project.id);
    
    // Custom Resizable Split
    const { size: explorerWidth, startResizing, isResizing } = useResizable({ initialSize: 220, minSize: 180, maxSize: 400 });
    
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState('');
    
    const prevFilesRef = useRef(Object.keys(project.files || {}));

    // Auto-select new files when they are created
    useEffect(() => {
        const currentFiles = Object.keys(project.files || {});
        const prevFiles = prevFilesRef.current;
        
        // Check for newly added file
        const newFile = currentFiles.find(f => !prevFiles.includes(f));
        if (newFile) {
            setSelectedFile(newFile);
        } else {
            // If currently selected file was deleted
            if (selectedFile && !currentFiles.includes(selectedFile)) {
                setSelectedFile(null);
            }
            // If nothing selected but files exist, select the first one (usually index.html or main script)
            else if (!selectedFile && currentFiles.length > 0) {
                // Prefer index.html or main.lua if available
                const priorityFile = currentFiles.find(f => f.includes('index.html') || f.includes('Main') || f.includes('server'));
                setSelectedFile(priorityFile || currentFiles[0]);
            }
        }
        
        prevFilesRef.current = currentFiles;
    }, [project.files, selectedFile]);

    // Keep editor content in sync with project state
    useEffect(() => {
        if (selectedFile) {
            const content = project.files?.[selectedFile]?.content ?? `// Error: Could not find content for ${selectedFile}`;
            setEditorContent(content);
        } else {
            setEditorContent(`// Select a file to view its code`);
        }
    }, [selectedFile, project.files]);

    const handleFileSelect = (filePath: string) => {
        setSelectedFile(filePath);
    };

    const handleEditorChange = (value: string | undefined) => {
        if (selectedFile && value !== undefined && onActiveProjectUpdate) {
            setEditorContent(value);
            const updatedFiles = {
                ...(project.files || {}),
                [selectedFile]: { content: value }
            };
            onActiveProjectUpdate({ files: updatedFiles });
        }
    };

    const fileLanguage = useMemo(() => {
        if (!selectedFile) return 'plaintext';
        if (selectedFile.endsWith('.html')) return 'html';
        if (selectedFile.endsWith('.css')) return 'css';
        if (selectedFile.endsWith('.js')) return 'javascript';
        if (selectedFile.endsWith('.ts')) return 'typescript';
        if (selectedFile.endsWith('.jsx')) return 'javascript'; 
        if (selectedFile.endsWith('.tsx')) return 'typescript';
        if (selectedFile.endsWith('.json')) return 'json';
        if (selectedFile.endsWith('.lua')) return 'lua';
        return 'plaintext';
    }, [selectedFile]);

    return (
        <div ref={containerRef} className="h-full w-full bg-bg-primary text-white relative">
            {/* Render Cursors Overlay */}
            {Object.entries(cursors).map(([id, cursor]: [string, any]) => (
                <Cursor key={id} x={cursor.x} y={cursor.y} color={cursor.color} label={cursor.user} />
            ))}

            <div 
                className="grid h-full"
                style={{ 
                    gridTemplateColumns: `${explorerWidth}px 2px 1fr`,
                    userSelect: isResizing ? 'none' : 'auto'
                }}
            >
                <div className="h-full bg-[#181818] overflow-hidden">
                   <FileExplorer 
                        onFileSelect={handleFileSelect} 
                        project={project} 
                        activeFile={selectedFile} 
                        writingFile={writingFile}
                        completedFiles={completedFiles}
                   />
                </div>

                <div 
                    className="h-full bg-[#2d2d2d] cursor-col-resize hover:bg-primary-start transition-colors"
                    onMouseDown={startResizing}
                />
                
                <div className="h-full w-full overflow-hidden bg-[#1e1e1e] flex flex-col">
                    {/* Editor Tab Bar */}
                    <div className="h-9 bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center px-4">
                        <span className="text-sm text-gray-300 font-medium flex items-center gap-2">
                            {selectedFile || 'No file selected'}
                            {selectedFile && <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 rounded">{fileLanguage}</span>}
                            {selectedFile === writingFile && (
                                <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                                    Writing...
                                </span>
                            )}
                        </span>
                    </div>
                    
                    <div className="flex-1 relative">
                        <Editor
                            height="100%"
                            path={selectedFile || 'default'} 
                            language={fileLanguage}
                            theme="vs-dark"
                            value={editorContent}
                            onChange={handleEditorChange}
                            options={{ 
                                minimap: { enabled: false }, 
                                fontSize: 14, 
                                wordWrap: 'on',
                                automaticLayout: true,
                                padding: { top: 16 },
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                fontLigatures: true,
                                scrollBeyondLastLine: false,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
