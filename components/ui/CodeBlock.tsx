
import React, { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon, EyeIcon, PlayIcon } from '@heroicons/react/24/solid';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string | null;
  onPreview?: () => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, filename, onPreview }) => {
  const { isCopied, copy } = useCopyToClipboard(code);

  const prismLanguage = language?.toLowerCase() || 'plaintext';
  const showLineNumbers = code.trim().split('\n').length > 5;

  // Heuristic to detect if it's a standalone HTML file that we should offer to run
  // This detects "sneaky" cases where the AI didn't use <CANVAS> but wrote a full app anyway.
  const isRunnableHtml = (prismLanguage === 'html' || prismLanguage === 'xml') && 
                         (code.includes('<!DOCTYPE html>') || code.includes('<html'));

  const handlePreviewClick = () => {
      if (onPreview) {
          onPreview();
      }
  };

  return (
    <div className="relative group bg-zinc-900/70 dark:bg-black/50 border border-border-color rounded-lg my-4 text-sm font-mono">
      <div className="flex justify-between items-center px-4 py-2 border-b border-border-color">
        <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold capitalize">{language}</span>
            {filename && <span className="text-xs text-gray-500">{filename}</span>}
        </div>
        <div className="flex items-center gap-2">
            {/* Sneaky Preview Button for HTML detected in standard blocks */}
            {onPreview && isRunnableHtml && (
                <button
                  onClick={handlePreviewClick}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-green-400 hover:text-white bg-green-500/10 hover:bg-green-500/20 rounded-md transition-colors border border-green-500/20"
                  title="Run this code"
                >
                  <PlayIcon className="w-3.5 h-3.5" />
                  <span>Run Preview</span>
                </button>
            )}
            
            {onPreview && !isRunnableHtml && (
                <button
                  onClick={onPreview}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                  title="Preview"
                >
                  <EyeIcon className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
            )}
            <button
              onClick={copy}
              className="p-1.5 bg-white/5 rounded-md text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Copy code"
            >
              {isCopied ? (
                  <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400"/>
              ) : (
                  <ClipboardDocumentIcon className="w-4 h-4"/>
              )}
            </button>
        </div>
      </div>

      <Highlight theme={themes.vsDark} code={code.trimEnd()} language={prismLanguage}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`${className} p-4 overflow-x-auto`} style={{...style, backgroundColor: 'transparent'}}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="table-row">
                {showLineNumbers && (
                    <span className="table-cell text-right pr-4 text-gray-500 select-none opacity-50 w-4">
                        {i + 1}
                    </span>
                )}
                <span className="table-cell">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                </span>
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
};
