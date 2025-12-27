
import React, { useState, useMemo, useEffect } from 'react';
import { FolderIcon, DocumentIcon, ChevronRightIcon, CodeBracketIcon, PhotoIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Project } from '../../../types';

interface TreeNode {
    name: string;
    type: 'folder' | 'file';
    path: string;
    children?: TreeNode[];
}

const buildTreeFromPaths = (files: Project['files']): TreeNode[] => {
    if (!files || Object.keys(files).length === 0) {
        return [];
    }

    const root: TreeNode = { name: 'root', type: 'folder', path: '', children: [] };

    for (const path in files) {
        const parts = path.split('/');
        let currentNode = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            
            let childNode = currentNode.children?.find(child => child.name === part);

            if (!childNode) {
                childNode = {
                    name: part,
                    type: isFile ? 'file' : 'folder',
                    path: parts.slice(0, i + 1).join('/'),
                    children: isFile ? undefined : [],
                };
                currentNode.children?.push(childNode);
            }
            
            if (childNode.type === 'folder') {
                currentNode = childNode;
            }
        }
    }
    
    const sortNodes = (nodes: TreeNode[] | undefined) => {
        if (!nodes) return;
        nodes.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        nodes.forEach(node => sortNodes(node.children));
    }
    
    sortNodes(root.children);
    return root.children || [];
};

const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.html')) return <CodeBracketIcon className="w-4 h-4 text-orange-400" />;
    if (fileName.endsWith('.css')) return <CodeBracketIcon className="w-4 h-4 text-blue-400" />;
    if (fileName.endsWith('.js') || fileName.endsWith('.ts')) return <CodeBracketIcon className="w-4 h-4 text-yellow-400" />;
    if (fileName.match(/\.(png|jpg|svg)$/)) return <PhotoIcon className="w-4 h-4 text-purple-400" />;
    return <DocumentIcon className="w-4 h-4 text-gray-500" />;
};

// Helper to normalize paths for comparison (remove ./ and leading /)
const normalize = (p: string) => p.replace(/^\.\//, '').replace(/^\//, '');

interface FileTreeProps {
    nodes: TreeNode[];
    onFileSelect: (path: string) => void;
    activeFile: string | null;
    writingFile?: string | null;
    completedFiles?: Set<string>;
    level?: number;
}

const FileTree: React.FC<FileTreeProps> = ({ nodes, onFileSelect, activeFile, writingFile, completedFiles, level = 0 }) => {
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    // Auto-expand folders if they contain the active or writing file
    useEffect(() => {
        const pathsToExpand = new Set<string>();
        const checkPath = (node: TreeNode) => {
            const normNodePath = normalize(node.path);
            const normActive = activeFile ? normalize(activeFile) : null;
            const normWriting = writingFile ? normalize(writingFile) : null;

            if (
                (normActive && normActive.startsWith(normNodePath)) || 
                (normWriting && normWriting.startsWith(normNodePath))
            ) {
                pathsToExpand.add(node.path);
            }
            node.children?.forEach(checkPath);
        };
        nodes.forEach(checkPath);
        
        if (pathsToExpand.size > 0) {
            setExpandedFolders(prev => {
                const next = { ...prev };
                pathsToExpand.forEach(p => next[p] = true);
                return next;
            });
        }
    }, [activeFile, writingFile, nodes]);

    const toggleFolder = (folderPath: string) => {
        setExpandedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
    };

    return (
        <div>
            {nodes.map(node => {
                const isExpanded = expandedFolders[node.path] || false;
                
                // Normalization for robust matching
                const normPath = normalize(node.path);
                // Fix: Handle null/undefined writingFile safely
                const normWriting = writingFile ? normalize(writingFile) : null;
                const isWriting = normWriting === normPath;
                
                // Check if any normalized path in completedFiles matches
                const isCompleted = completedFiles ? Array.from(completedFiles).some((f: string) => normalize(f) === normPath) : false;
                
                const isActive = activeFile ? normalize(activeFile) === normPath : false;
                
                if (node.type === 'folder') {
                    return (
                        <div key={node.path}>
                            <div 
                                className={`flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                style={{ paddingLeft: `${level * 12 + 8}px` }}
                                onClick={() => toggleFolder(node.path)}
                            >
                                <ChevronRightIcon className={`w-3 h-3 flex-shrink-0 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                <FolderIcon className="w-4 h-4 text-blue-300/70 flex-shrink-0" /> 
                                <span className="text-xs text-gray-300 truncate select-none">{node.name}</span>
                            </div>
                            {isExpanded && node.children && node.children.length > 0 && (
                                <FileTree nodes={node.children} onFileSelect={onFileSelect} activeFile={activeFile} writingFile={writingFile} completedFiles={completedFiles} level={level + 1} />
                            )}
                        </div>
                    )
                }
                
                return (
                     <div 
                        key={node.path} 
                        style={{ paddingLeft: `${level * 12 + 20}px` }}
                        onClick={() => onFileSelect(node.path)}
                    >
                        <div className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-all duration-200 group ${isActive ? 'bg-primary-start/20 text-white' : 'hover:bg-white/5 text-gray-400'}`}>
                            <div className="relative flex items-center justify-center w-4 h-4">
                                {isWriting ? (
                                    <div className="w-3.5 h-3.5 border-2 border-t-primary-start border-white/20 rounded-full animate-spin"></div>
                                ) : isCompleted ? (
                                    <CheckCircleIcon className="w-4 h-4 text-green-400 animate-pulse" />
                                ) : (
                                    getFileIcon(node.name)
                                )}
                            </div>
                            <span className={`text-xs truncate select-none flex-1 ${isActive ? 'text-white font-medium' : 'group-hover:text-gray-200'}`}>{node.name}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

interface FileExplorerProps {
    onFileSelect: (path: string) => void;
    project: Project;
    activeFile?: string | null;
    writingFile?: string | null;
    completedFiles?: Set<string>;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, project, activeFile, writingFile, completedFiles }) => {
  const fileTree = useMemo(() => buildTreeFromPaths(project.files), [project.files]);

  return (
    <div className="bg-[#181818] h-full flex flex-col border-r border-[#2d2d2d]">
      <div className="p-3 border-b border-[#2d2d2d] flex justify-between items-center bg-[#1e1e1e]">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Explorer</h2>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-500">{Object.keys(project.files || {}).length} files</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
        {fileTree.length > 0 ? (
            <FileTree 
                nodes={fileTree} 
                onFileSelect={onFileSelect} 
                activeFile={activeFile} 
                writingFile={writingFile}
                completedFiles={completedFiles}
            />
        ) : (
            <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500 mb-2">No files yet.</p>
                <p className="text-xs text-gray-600">Files will appear here as the AI builds.</p>
            </div>
        )}
      </div>
    </div>
  );
};
