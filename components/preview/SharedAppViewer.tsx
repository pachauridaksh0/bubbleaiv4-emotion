
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getProject } from '../../services/databaseService';
import { Project } from '../../types';
import { WebAppPreview } from './WebAppPreview';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface SharedAppViewerProps {
    projectId?: string;
}

export const SharedAppViewer: React.FC<SharedAppViewerProps> = ({ projectId }) => {
    const { supabase } = useAuth(); // Need auth context to access DB
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fallback if prop not provided (though App.tsx should provide it)
    const effectiveId = projectId;

    useEffect(() => {
        const loadProject = async () => {
            if (!effectiveId) {
                setError("No project ID specified.");
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                // Fetch the project data. 
                // Note: RLS policies must allow public read access for shared projects, 
                // or use a secure function if strict privacy is enabled. 
                // For this implementation, we assume if you have the ID, you can view it (or it's public).
                const data = await getProject(supabase, effectiveId);
                if (data) {
                    setProject(data);
                } else {
                    setError("Project not found or you do not have permission to view it.");
                }
            } catch (err: any) {
                console.error("Shared view load error:", err);
                setError("Failed to load the application.");
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [effectiveId, supabase]);

    if (loading) {
        return (
            <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#09090b] text-white">
                <div className="w-16 h-16 border-4 border-t-primary-start border-white/10 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 font-mono animate-pulse">Initializing Application...</p>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#09090b] text-white p-8 text-center">
                <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mb-6" />
                <h1 className="text-3xl font-bold mb-2">Application Error</h1>
                <p className="text-gray-400 max-w-md">{error || "The project could not be found."}</p>
                <a href="/" className="mt-8 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-medium">
                    Go to Bubble AI Home
                </a>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen bg-black overflow-hidden relative">
            <WebAppPreview project={project} />
            
            {/* Branding Overlay */}
            <div className="absolute bottom-4 right-4 z-[9999] pointer-events-none opacity-50 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-lg">🫧</span>
                    <span className="text-xs font-bold text-white tracking-wide">Built with Bubble</span>
                </div>
            </div>
        </div>
    );
};
