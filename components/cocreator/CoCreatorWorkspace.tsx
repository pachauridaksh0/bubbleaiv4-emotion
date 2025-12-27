
import React from 'react';
import { Project } from '../../types';
import { IdeWorkspaceProps } from './shared/IdeWorkspace';
import { RobloxWorkspace } from './roblox/RobloxWorkspace';
import { WebAppWorkspace } from './webapp/WebAppWorkspace';
import { StoryWorkspace } from './story/StoryWorkspace';
import { VideoWorkspace } from './video/VideoWorkspace';
import { DesignWorkspace } from './design/DesignWorkspace';
import { PresentationWorkspace } from './presentation/PresentationWorkspace';
import { DocumentWorkspace } from './document/DocumentWorkspace';

interface CoCreatorWorkspaceProps extends IdeWorkspaceProps {
    project: Project | null;
}

export const CoCreatorWorkspace: React.FC<CoCreatorWorkspaceProps> = (props) => {
    const { project } = props;

    if (!project) {
        return (
            <div className="flex items-center justify-center h-full text-center p-8 text-gray-500 bg-bg-primary">
               <div>
                   <h2 className="text-xl font-semibold text-gray-300">Loading Workspace...</h2>
               </div>
           </div>
       );
    }

    switch (project.project_type) {
        case 'roblox_game':
            return <RobloxWorkspace {...props} project={project} />;
        case 'website':
            return <WebAppWorkspace {...props} project={project} />;
        case 'story':
            return <StoryWorkspace {...props} project={project} />;
        case 'video':
            return <VideoWorkspace {...props} project={project} />;
        case 'design':
            return <DesignWorkspace {...props} project={project} />;
        case 'presentation':
            return <PresentationWorkspace {...props} project={project} />;
        case 'document':
            return <DocumentWorkspace {...props} project={project} />;
        default:
            // Fallback for conversation or unknown types
            return (
                 <div className="flex items-center justify-center h-full text-center p-8 text-gray-500 bg-bg-primary">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-300">Unsupported Project Type</h2>
                        <p>This project type ('{project.project_type}') does not have a dedicated workspace.</p>
                    </div>
                </div>
            );
    }
};
