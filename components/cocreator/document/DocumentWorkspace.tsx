
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Split from 'react-split-grid';
import { IdeWorkspaceProps } from '../shared/IdeWorkspace';
import { ChatView } from '../../chat/ChatView';
import { useWindowSize } from '../../../hooks/useWindowSize';
import { 
    ListBulletIcon, QueueListIcon, LinkIcon 
} from '@heroicons/react/24/outline';

const ToolbarButton: React.FC<{ 
    icon: React.ReactNode; 
    label: string; 
    onClick: () => void; 
}> = ({ icon, label, onClick }) => (
    <button 
        onClick={onClick}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
        title={label}
    >
        {icon}
    </button>
);

// Wrapper for correct sizing
const IconWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="w-5 h-5 flex items-center justify-center">{children}</div>
);

const DocumentEditor: React.FC<{
    project: IdeWorkspaceProps['project'];
    onActiveProjectUpdate: IdeWorkspaceProps['onActiveProjectUpdate'];
}> = ({ project, onActiveProjectUpdate }) => {
    
    const [content, setContent] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const documentFile = useMemo(() => {
        if (!project.files) return null;
        const filePaths = Object.keys(project.files);
        // Prioritize .md, then .txt, then the first file found
        return filePaths.find(p => p.endsWith('.md')) || filePaths.find(p => p.endsWith('.txt')) || filePaths[0] || 'document.md';
    }, [project.files]);

    useEffect(() => {
        const fileContent = documentFile ? project.files?.[documentFile]?.content || '' : 'Start writing your document... The AI will create a file for you.';
        setContent(fileContent);
    }, [documentFile, project.files]);

    useEffect(() => {
        // Debounced auto-save
        const handler = setTimeout(() => {
            if (documentFile && onActiveProjectUpdate && content !== project.files?.[documentFile]?.content) {
                 const updatedFiles = {
                    ...(project.files || {}),
                    [documentFile]: { content: content }
                };
                onActiveProjectUpdate({ files: updatedFiles });
            }
        }, 1500); 

        return () => {
            clearTimeout(handler);
        };
    }, [content, documentFile, project.files, onActiveProjectUpdate]);

    const insertFormatting = (prefix: string, suffix: string = '') => {
        if (!textareaRef.current) return;
        
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = textareaRef.current.value;
        const selectedText = text.substring(start, end);
        
        const replacement = `${prefix}${selectedText}${suffix}`;
        
        const newContent = text.substring(0, start) + replacement + text.substring(end);
        
        setContent(newContent);
        
        // Restore focus and selection
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(start + prefix.length, end + prefix.length);
            }
        }, 0);
    };

    return (
        <div className="flex flex-col h-full bg-bg-primary">
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-border-color bg-bg-secondary/50">
                <ToolbarButton 
                    icon={<IconWrapper><span className="font-bold font-serif text-lg">B</span></IconWrapper>} 
                    label="Bold" 
                    onClick={() => insertFormatting('**', '**')} 
                />
                <ToolbarButton 
                    icon={<IconWrapper><span className="italic font-serif text-lg">I</span></IconWrapper>} 
                    label="Italic" 
                    onClick={() => insertFormatting('*', '*')} 
                />
                <div className="w-px h-6 bg-white/10 mx-2" />
                <ToolbarButton 
                    icon={<IconWrapper><span className="font-bold text-sm">H1</span></IconWrapper>} 
                    label="Heading 1" 
                    onClick={() => insertFormatting('# ')} 
                />
                <ToolbarButton 
                    icon={<IconWrapper><span className="font-bold text-sm">H2</span></IconWrapper>} 
                    label="Heading 2" 
                    onClick={() => insertFormatting('## ')} 
                />
                <div className="w-px h-6 bg-white/10 mx-2" />
                <ToolbarButton 
                    icon={<IconWrapper><ListBulletIcon/></IconWrapper>} 
                    label="Bullet List" 
                    onClick={() => insertFormatting('- ')} 
                />
                <ToolbarButton 
                    icon={<IconWrapper><QueueListIcon/></IconWrapper>} 
                    label="Numbered List" 
                    onClick={() => insertFormatting('1. ')} 
                />
                <div className="w-px h-6 bg-white/10 mx-2" />
                <ToolbarButton 
                    icon={<IconWrapper><LinkIcon/></IconWrapper>} 
                    label="Link" 
                    onClick={() => insertFormatting('[', '](url)')} 
                />
            </div>

            {/* Editor Area */}
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full p-8 lg:p-12 bg-bg-primary text-gray-300 resize-none focus:outline-none leading-relaxed prose prose-invert max-w-none font-mono text-sm md:text-base"
                placeholder="Start writing your document..."
            />
            
            {/* Status Bar */}
            <div className="px-4 py-2 text-xs text-gray-500 border-t border-border-color bg-bg-secondary/20 flex justify-between">
                <span>{content.length} characters</span>
                <span>{documentFile || 'Unsaved'}</span>
            </div>
        </div>
    );
};


export const DocumentWorkspace: React.FC<IdeWorkspaceProps> = (props) => {
    const { width } = useWindowSize();
    const isMobile = width ? width < 1024 : false;

    if (isMobile) {
        return <ChatView {...props} />;
    }

    return (
        <div className="h-full w-full bg-transparent text-white">
            <Split gridTemplateColumns="minmax(350px, 1fr) 8px 2fr" minSize={300} cursor="col-resize">
                {(split: any) => (
                    <div className="grid h-full w-full bg-bg-primary" {...split.getGridProps()}>
                        <div className="h-full bg-bg-secondary overflow-hidden">
                            <ChatView {...props} />
                        </div>
                        <div className="h-full bg-bg-tertiary cursor-col-resize" {...split.getGutterProps('column', 1)} />
                        <div className="h-full overflow-hidden">
                           <DocumentEditor project={props.project} onActiveProjectUpdate={props.onActiveProjectUpdate} />
                        </div>
                    </div>
                )}
            </Split>
        </div>
    );
};
