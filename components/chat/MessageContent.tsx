
import React from 'react';
import { CodeBlock } from '../ui/CodeBlock';
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

// Enhanced Table Renderer for Excel compatibility
const MarkdownTable: React.FC<{ markdown: string }> = ({ markdown }) => {
    const { isCopied, copy } = useCopyToClipboard('');

    const parseTable = () => {
        const lines = markdown.trim().split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return null;

        const headerLine = lines[0];
        const alignmentLine = lines[1];
        const dataLines = lines.slice(2);

        const splitRow = (row: string) => {
            if (!row) return [];
            const cleanRow = row.trim().replace(/^\||\|$/g, '');
            return cleanRow.split('|').map(c => c.trim());
        };

        const headers = splitRow(headerLine);
        const alignments = splitRow(alignmentLine).map(a => {
            const trim = a.trim();
            if (trim.startsWith(':') && trim.endsWith(':')) return 'center';
            if (trim.endsWith(':')) return 'right';
            return 'left';
        });

        const rows = dataLines.map(line => splitRow(line));

        return { headers, alignments, rows };
    };

    const tableData = parseTable();
    if (!tableData || tableData.headers.length === 0) return <pre className="text-xs whitespace-pre-wrap break-words text-text-primary">{markdown}</pre>;

    const handleCopyTable = () => {
        const headerStr = tableData.headers.join('\t');
        const rowsStr = tableData.rows.map(row => row.join('\t')).join('\n');
        const tsv = `${headerStr}\n${rowsStr}`;
        
        navigator.clipboard.writeText(tsv).then(() => {
            copy(); 
            navigator.clipboard.writeText(tsv);
        });
    };

    return (
        <div className="my-6 not-prose max-w-full overflow-hidden">
            <div className="flex justify-end mb-1">
                <button 
                    onClick={handleCopyTable}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-interactive-hover rounded transition-colors border border-border-color"
                    title="Copy for Excel/Sheets"
                >
                    {isCopied ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                    <span>{isCopied ? 'Copied!' : 'Copy Table'}</span>
                </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border-color bg-bg-secondary shadow-sm">
                <table 
                    className="w-full text-sm text-left text-text-primary border-collapse min-w-[500px]" 
                    style={{ borderCollapse: 'collapse' }}
                >
                    <thead className="text-xs uppercase bg-bg-tertiary text-text-secondary">
                        <tr>
                            {tableData.headers.map((h, i) => (
                                <th key={i} className="px-6 py-3 border-b border-r border-border-color last:border-r-0 font-bold tracking-wider">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-bg-primary">
                        {tableData.rows.map((row, i) => (
                            <tr key={i} className="border-b border-border-color hover:bg-bg-tertiary transition-colors">
                                {row.map((cell, j) => (
                                    <td 
                                        key={j} 
                                        className={`px-6 py-4 border-r border-border-color last:border-r-0 ${
                                            tableData.alignments[j] === 'center' ? 'text-center' : 
                                            tableData.alignments[j] === 'right' ? 'text-right' : 'text-left'
                                        }`}
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const TextRenderer: React.FC<{ text: string; highlight: string; onPreviewHtml?: (code: string) => void }> = ({ text, highlight, onPreviewHtml }) => {
    // Basic cleanup
    const cleanText = text
        .replace(/<THINK>[\s\S]*?<\/THINK>/gi, '')
        .replace(/<CANVAS>[\s\S]*?<\/CANVAS>/gi, '')
        .replace(/<SEARCH>[\s\S]*?<\/SEARCH>/gi, '') // Also hide search tag from main text
        .trim();
    
    if (!cleanText) return null;

    const lines = cleanText.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const nextLine = lines[i + 1];

        // Table Handling
        if (
            line.trim().startsWith('|') && 
            nextLine && 
            nextLine.trim().startsWith('|') && 
            nextLine.includes('---')
        ) {
            const tableLines = [line];
            i++; 
            tableLines.push(lines[i]); 
            i++; 
            
            while (i < lines.length) {
                const currentLine = lines[i];
                if (currentLine.trim().startsWith('|')) {
                    tableLines.push(currentLine);
                    i++;
                } else {
                    break;
                }
            }
            
            elements.push(<MarkdownTable key={`table-${i}`} markdown={tableLines.join('\n')} />);
            continue;
        }

        const trimmed = line.trim();
        
        // Headers & Formatting - REPLACED HARDCODED COLORS WITH SEMANTIC VARIABLES
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            elements.push(<hr key={i} className="my-6 border-border-color" />);
        } else if (trimmed.startsWith('#### ')) {
            elements.push(<h4 key={i} className="text-base font-bold text-text-primary mt-4 mb-2 tracking-tight">{renderInline(trimmed.slice(5), highlight)}</h4>);
        } else if (trimmed.startsWith('### ')) {
            elements.push(<h3 key={i} className="text-lg font-bold text-text-primary mt-4 mb-2 tracking-tight">{renderInline(trimmed.slice(4), highlight)}</h3>);
        } else if (trimmed.startsWith('## ')) {
            elements.push(<h2 key={i} className="text-xl font-bold text-text-primary mt-6 mb-3 border-b border-border-color pb-1 tracking-tight">{renderInline(trimmed.slice(3), highlight)}</h2>);
        } else if (trimmed.startsWith('# ')) {
            elements.push(<h1 key={i} className="text-2xl font-extrabold text-text-primary mt-6 mb-4 tracking-tight">{renderInline(trimmed.slice(2), highlight)}</h1>);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
             elements.push(
                <div key={i} className="flex items-start gap-2 mb-1 ml-4">
                    <span className="text-text-secondary mt-1.5 w-1.5 h-1.5 bg-current rounded-full flex-shrink-0"></span>
                    <p className="leading-relaxed text-text-primary">{renderInline(trimmed.slice(2), highlight)}</p>
                </div>
             );
        } else if (trimmed.match(/^\d+\.\s/)) {
             const match = trimmed.match(/^(\d+)\.\s(.*)/);
             if (match) {
                 elements.push(
                    <div key={i} className="flex items-start gap-2 mb-1 ml-4">
                        <span className="text-text-secondary font-mono font-bold flex-shrink-0">{match[1]}.</span>
                        <p className="leading-relaxed text-text-primary">{renderInline(match[2], highlight)}</p>
                    </div>
                 );
             } else {
                 elements.push(<p key={i} className={`mb-1 leading-relaxed text-text-primary ${line.trim() === '' ? 'min-h-[0.5rem]' : ''}`}>{renderInline(line, highlight)}</p>);
             }
        } else {
            elements.push(
                <p key={i} className={`mb-1 leading-relaxed text-text-primary ${line.trim() === '' ? 'min-h-[0.5rem]' : ''}`}>
                    {renderInline(line, highlight)}
                </p>
            );
        }
        i++;
    }

    return <>{elements}</>;
};

const renderInline = (text: string, highlight: string): React.ReactNode[] => {
    const regex = /(\[\d+\])|(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|___[\s\S]+?___|__[\s\S]+?__|_[\s\S]+?_)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
        if (!part) return null;

        if (/^\[\d+\]$/.test(part)) {
            return (
                <sup key={index} className="citation ml-0.5 text-[10px] font-bold text-blue-400 cursor-pointer select-none bg-blue-500/10 px-1 rounded-sm hover:bg-blue-500/30 hover:text-blue-300 transition-colors" title="Source Reference">
                    {part}
                </sup>
            );
        }

        if (part.startsWith('***') && part.endsWith('***')) return <strong key={index} className="text-text-primary"><em>{applyHighlight(part.slice(3, -3), highlight)}</em></strong>;
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="text-text-primary">{applyHighlight(part.slice(2, -2), highlight)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index} className="text-text-primary">{applyHighlight(part.slice(1, -1), highlight)}</em>;
        if (part.startsWith('___') && part.endsWith('___')) return <strong key={index} className="text-text-primary"><em>{applyHighlight(part.slice(3, -3), highlight)}</em></strong>;
        if (part.startsWith('__') && part.endsWith('__')) return <strong key={index} className="text-text-primary">{applyHighlight(part.slice(2, -2), highlight)}</strong>;
        if (part.startsWith('_') && part.endsWith('_')) return <em key={index} className="text-text-primary">{applyHighlight(part.slice(1, -1), highlight)}</em>;

        return applyHighlight(part, highlight);
    });
};

const applyHighlight = (str: string, highlight: string): React.ReactNode[] => {
    if (!highlight.trim()) return [str];
    const highlightRegex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = str.split(highlightRegex);
    return parts.map((p, i) => highlightRegex.test(p) ? <mark key={i} className="bg-yellow-400 text-black rounded px-0.5">{p}</mark> : p);
};

interface MessageContentProps {
  content: string;
  searchQuery: string;
  sender: 'user' | 'ai';
  isTyping?: boolean;
  onPreviewHtml?: (code: string) => void;
}

const codeBlockRegex = /```(\w+)?(?::(\S+))?\s*([\s\S]*?)```/g;
const splitRegex = /(```(?:\w+)?(?::\S+)?\s*[\s\S]*?```)/g;

export const MessageContent: React.FC<MessageContentProps> = ({ content, searchQuery, sender, isTyping = false, onPreviewHtml }) => {
  if (!content && !isTyping) return null;

  const parts = content.split(splitRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        const match = [...part.matchAll(codeBlockRegex)][0];
        
        if (match) {
          const language = match[1] || 'plaintext';
          const filename = match[2] || null;
          const code = match[3].trim();
          
          return (
            <div key={index} className="not-prose my-4 max-w-full overflow-hidden">
                <CodeBlock code={code} language={language} filename={filename} onPreview={onPreviewHtml ? () => onPreviewHtml(code) : undefined} />
            </div>
          );
        } else {
          return <div key={index} className="prose-text break-words min-w-0"><TextRenderer text={part} highlight={searchQuery} onPreviewHtml={onPreviewHtml} /></div>;
        }
      })}
      {isTyping && sender === 'ai' && (
        <span className="inline-block w-0.5 h-5 align-bottom bg-text-primary animate-blink ml-1" />
      )}
    </>
  );
};
