
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Project } from '../../types';
import { 
    ComputerDesktopIcon, 
    ArrowPathIcon, 
    ArrowDownTrayIcon, 
    CommandLineIcon, 
} from '@heroicons/react/24/outline';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'framer-motion';

interface WebAppPreviewProps {
  project: Project;
  onFixError?: (error: string) => void;
}

interface LogEntry {
    id: string;
    type: 'info' | 'error' | 'success' | 'warning';
    message: string;
    timestamp: Date;
}

export const WebAppPreview: React.FC<WebAppPreviewProps> = ({ project, onFixError }) => {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [key, setKey] = useState(0); 
  const [isBuilding, setIsBuilding] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
      setLogs(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          type,
          message,
          timestamp: new Date()
      }]);
      if (type === 'error') {
          setBuildStatus('error');
          // If a callback is provided, report the error up
          if (onFixError) {
              onFixError(message);
          }
      }
  }, [onFixError]);

  useEffect(() => {
      setBuildStatus('idle');
      addLog('--- Project Updated ---', 'info');
  }, [project.files, addLog]);

  const handleDownload = async () => {
      if (!project.files) return;
      const zip = new JSZip();
      
      const packageJson = {
          name: project.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          version: '0.0.0',
          type: 'module',
          scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
          dependencies: { 
              "react": "^18.2.0", "react-dom": "^18.2.0", "lucide-react": "latest", 
              "clsx": "latest", "tailwind-merge": "latest", "framer-motion": "latest" 
          },
          devDependencies: { "@vitejs/plugin-react": "^4.2.1", "vite": "^5.2.0", "tailwindcss": "^3.4.3", "autoprefixer": "^10.4.19", "postcss": "^8.4.38" }
      };

      Object.entries(project.files).forEach(([path, file]) => {
          const fileData = file as { content: string };
          if (path === 'package.json') {
              try {
                  const aiPackage = JSON.parse(fileData.content);
                  packageJson.dependencies = { ...packageJson.dependencies, ...aiPackage.dependencies };
              } catch (e) {}
          } else {
              zip.file(path, fileData.content);
          }
      });
      
      if (!zip.file('package.json')) zip.file('package.json', JSON.stringify(packageJson, null, 2));
      
      if (!Object.keys(project.files).some(k => k.endsWith('index.html'))) {
          zip.file('index.html', `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${project.name}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!project.files || Object.keys(project.files).length === 0) {
        setIframeUrl(null);
        return;
    }

    setIsBuilding(true);
    setBuildStatus('building');
    setLogs([]);
    addLog('Starting build...', 'info');

    const build = async () => {
        try {
            const files = project.files || {};
            
            const entryFile = Object.keys(files).find(f => f.match(/src\/(main|index)\.(tsx|jsx|ts|js)$/));
            const htmlFileKey = Object.keys(files).find(f => f.endsWith('index.html'));
            
            if (!entryFile) {
                throw new Error("Missing entry file (e.g., src/main.tsx).");
            }
            addLog(`Entry point found: ${entryFile}`, 'info');

            let htmlContent = htmlFileKey ? files[htmlFileKey].content : '<div id="root"></div>';
            htmlContent = htmlContent.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, ""); 

            const serializedFiles = JSON.stringify(files).replace(/<\/script>/g, '<\\/script>');
            
            const bundlerScript = `
                window.onerror = function(msg, url, line, col, error) {
                    window.parent.postMessage({ type: 'PREVIEW_LOG', log: { type: 'error', message: msg } }, '*');
                    return false;
                };

                console.log = function(...args) {
                    window.parent.postMessage({ type: 'PREVIEW_LOG', log: { type: 'info', message: args.join(' ') } }, '*');
                };
                
                console.error = function(...args) {
                    window.parent.postMessage({ type: 'PREVIEW_LOG', log: { type: 'error', message: args.join(' ') } }, '*');
                };

                // Helper to create safe data URIs for UTF-8 content
                function toDataUri(content, mimeType) {
                    return 'data:' + mimeType + ';base64,' + btoa(unescape(encodeURIComponent(content)));
                }

                async function boot() {
                    try {
                        console.log("Initializing Virtual File System...");
                        const files = ${serializedFiles};
                        
                        function resolvePath(base, relative) {
                            const stack = base.split('/');
                            stack.pop(); 
                            const parts = relative.split('/');
                            for (let i = 0; i < parts.length; i++) {
                                if (parts[i] === '.') continue;
                                if (parts[i] === '..') stack.pop();
                                else stack.push(parts[i]);
                            }
                            return stack.join('/');
                        }

                        // Inject CSS
                        for (const [path, file] of Object.entries(files)) {
                            // Fix: Explicit cast to ensure 'file' has 'content' property
                            const fileContent = (file).content;
                            if (path.endsWith('.css')) {
                                const style = document.createElement('style');
                                style.textContent = fileContent;
                                document.head.appendChild(style);
                                console.log("Injected CSS: " + path);
                            }
                        }

                        const importMap = { imports: {} };
                        
                        // CONSTANT: Pin React Version to prevent duplicate instances
                        const reactVersion = '18.2.0';
                        const deps = \`react@\${reactVersion},react-dom@\${reactVersion}\`;

                        // External Libs - Using esm.sh with pinned dependencies
                        importMap.imports['react'] = \`https://esm.sh/react@\${reactVersion}?dev\`;
                        importMap.imports['react-dom/client'] = \`https://esm.sh/react-dom@\${reactVersion}/client?dev&deps=\${deps}\`;
                        importMap.imports['react/jsx-runtime'] = \`https://esm.sh/react@\${reactVersion}/jsx-runtime?dev&deps=\${deps}\`;
                        
                        // Force third-party libs to use the SAME React instance
                        importMap.imports['clsx'] = 'https://esm.sh/clsx';
                        importMap.imports['tailwind-merge'] = 'https://esm.sh/tailwind-merge';
                        importMap.imports['lucide-react'] = \`https://esm.sh/lucide-react?dev&deps=\${deps}\`;
                        importMap.imports['framer-motion'] = \`https://esm.sh/framer-motion?dev&deps=\${deps}\`;
                        importMap.imports['react-router-dom'] = \`https://esm.sh/react-router-dom?dev&deps=\${deps}\`;
                        importMap.imports['recharts'] = \`https://esm.sh/recharts?dev&deps=\${deps}\`;
                        importMap.imports['date-fns'] = 'https://esm.sh/date-fns';
                        
                        console.log("Transpiling modules...");
                        
                        for (const [path, file] of Object.entries(files)) {
                            if (!path.match(/\\.(tsx|ts|jsx|js)$/)) continue;
                            
                            // Fix: Explicit cast here too inside the bundler script string generation
                            const fileContent = file.content;

                            try {
                                const { code } = Babel.transform(fileContent, {
                                    presets: [
                                        ['react', { runtime: 'automatic' }], 
                                        'typescript'
                                    ],
                                    filename: path,
                                });

                                // Rewrite imports to absolute "https://project/..." paths
                                const { code: finalCode } = Babel.transform(code, {
                                    plugins: [{
                                        visitor: {
                                            ImportDeclaration(p) {
                                                const source = p.node.source.value;
                                                
                                                // STRIP CSS IMPORTS
                                                if (source.endsWith('.css')) {
                                                    p.remove();
                                                    return;
                                                }

                                                if (source.startsWith('.')) {
                                                    const resolved = resolvePath(path, source);
                                                    p.node.source.value = 'https://project/' + resolved;
                                                } else {
                                                    if (!importMap.imports[source]) {
                                                        if (!['react', 'react-dom'].some(k => source.includes(k))) {
                                                             // Add deps param to unknown external libs too, just in case
                                                             p.node.source.value = \`https://esm.sh/\${source}?dev&deps=\${deps}\`;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }]
                                });
                                
                                const dataUri = toDataUri(finalCode, 'text/javascript');
                                
                                const absPath = 'https://project/' + path;
                                importMap.imports[absPath] = dataUri;
                                importMap.imports[absPath.replace(/\\.(tsx|ts|jsx|js)$/, '')] = dataUri;
                                
                            } catch (e) {
                                console.error("Babel Error in " + path + ": " + e.message);
                            }
                        }
                        
                        const mapEl = document.createElement('script');
                        mapEl.type = 'importmap';
                        mapEl.textContent = JSON.stringify(importMap);
                        document.head.appendChild(mapEl);
                        
                        console.log("Import Map Injected.");

                        // Start
                        const entryKey = "https://project/${entryFile}";
                        console.log("Booting from: " + entryKey);
                        
                        setTimeout(() => {
                            import(entryKey)
                                .then(() => {
                                    window.parent.postMessage({ type: 'PREVIEW_LOG', log: { type: 'success', message: 'Build complete. App running.' } }, '*');
                                })
                                .catch(e => {
                                    console.error("Runtime Boot Error: " + e.message);
                                });
                        }, 50);

                    } catch (e) {
                        console.error("Bootloader Error: " + e.message);
                    }
                }
                
                boot();
            `;

            const finalHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8" />
                    <script src="https://cdn.tailwindcss.com"></script>
                    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
                    <style>
                        body { background-color: #ffffff; color: #000; font-family: sans-serif; margin: 0; }
                        #root { width: 100%; min-height: 100vh; }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                    <script>${bundlerScript}</script>
                </body>
                </html>
            `;

            const blob = new Blob([finalHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            setIframeUrl(url);
            
            setTimeout(() => {
                setIsBuilding(false);
                setBuildStatus('success');
            }, 1000);

            return () => URL.revokeObjectURL(url);

        } catch (e: any) {
            addLog(e.message, 'error');
            setIsBuilding(false);
            setBuildStatus('error');
        }
    };

    const cleanup = build();
    return () => { cleanup.then(c => c && c()); };

  }, [project.files]);

  useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
          if (!event.data) return;
          if (event.data.type === 'PREVIEW_LOG') {
              const { type, message } = event.data.log;
              addLog(message, type);
          }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
  }, [addLog]);

  const handleReload = () => {
      setKey(prev => prev + 1);
  };

  return (
    <div className="w-full h-full bg-[#1e1e1e] overflow-hidden relative flex flex-col">
      <div className="h-10 bg-[#252526] border-b border-[#3e3e3e] flex items-center px-4 gap-3 flex-shrink-0 justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex gap-1.5 opacity-60">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              </div>
              <div className="text-xs text-gray-400 font-mono truncate flex-1">
                  preview://localhost:3000
              </div>
          </div>

          <div className="flex items-center gap-1">
              <div className="relative">
                  <button 
                    onClick={() => setIsLogOpen(!isLogOpen)}
                    className={`p-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                        buildStatus === 'error' ? 'text-red-400 hover:bg-red-500/10' :
                        buildStatus === 'building' ? 'text-yellow-400 hover:bg-yellow-500/10' :
                        isLogOpen ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Build Logs"
                  >
                      <CommandLineIcon className="w-4 h-4" />
                      {buildStatus === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                      {buildStatus === 'building' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />}
                  </button>

                  <AnimatePresence>
                      {isLogOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsLogOpen(false)} />
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
                            >
                                <div className="p-3 border-b border-[#3e3e3e] flex justify-between items-center bg-[#252526]">
                                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Build Console</span>
                                    <button onClick={() => setLogs([])} className="text-[10px] text-gray-500 hover:text-white">Clear</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs custom-scrollbar">
                                    {logs.length === 0 ? (
                                        <div className="text-center py-8 text-gray-600 italic">No logs yet...</div>
                                    ) : (
                                        logs.map(log => (
                                            <div key={log.id} className="flex gap-2 items-start p-1.5 hover:bg-white/5 rounded">
                                                <span className="text-gray-600 flex-shrink-0 select-none">
                                                    {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                                                </span>
                                                <span className={`break-all ${
                                                    log.type === 'error' ? 'text-red-400' :
                                                    log.type === 'warning' ? 'text-yellow-400' :
                                                    log.type === 'success' ? 'text-green-400' : 'text-gray-300'
                                                }`}>
                                                    {log.message}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                          </>
                      )}
                  </AnimatePresence>
              </div>

              <div className="w-px h-4 bg-[#3e3e3e] mx-1"></div>

              <button onClick={handleReload} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md" title="Reload">
                  <ArrowPathIcon className={`w-4 h-4 ${isBuilding ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={handleDownload} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md" title="Export ZIP">
                  <ArrowDownTrayIcon className="w-4 h-4" />
              </button>
          </div>
      </div>

      <div className="relative flex-1 bg-white">
          {iframeUrl ? (
            <iframe
              ref={iframeRef}
              key={key}
              src={iframeUrl}
              title="Web App Preview"
              className="w-full h-full border-none bg-white"
              allow="accelerometer; camera; encrypted-media; display-capture; geolocation; gyroscope; microphone; midi; clipboard-read; clipboard-write; web-share; serial; xr-spatial-tracking; pointer-lock"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-pointer-lock"
            />
          ) : (
            <div className="p-4 h-full flex flex-col items-center justify-center bg-[#1e1e1e] text-center">
              <ComputerDesktopIcon className="w-16 h-16 text-gray-700 mb-4" />
              <h3 className="font-semibold text-gray-400 text-lg">Initializing Environment</h3>
              <p className="text-gray-500 text-sm max-w-xs mt-2">
                Booting up the virtual ESM bundler...
              </p>
            </div>
          )}
      </div>
    </div>
  );
};
