
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ProjectType } from '../../types';

interface InitialPromptViewProps {
  onSendMessage: (text: string) => void;
  projectType?: ProjectType;
}

export const InitialPromptView: React.FC<InitialPromptViewProps> = ({ onSendMessage, projectType = 'roblox_game' }) => {
  
  const promptStarters = useMemo(() => {
      const starters: Record<string, string[]> = {
          roblox_game: [
              "How do I make a part that gives players points?",
              "Create a plan for a simple sword fighting game",
              "What's the best way to handle player data?",
              "Write a script for a day/night cycle",
          ],
          website: [
              "Create a landing page for a coffee shop",
              "How do I center a div using Tailwind?",
              "Build a contact form with validation",
              "Explain the project structure for a React app",
          ],
          document: [
              "Draft an outline for a technical specification",
              "Write a meeting summary template",
              "Brainstorm blog post ideas about AI",
              "Proofread this text for clarity",
          ],
          presentation: [
              "Create a 5-slide pitch deck for a startup",
              "Outline a presentation on climate change",
              "Generate slide content for a project update",
              "Suggest visuals for a slide about growth",
          ],
          story: [
              "Develop a character profile for the protagonist",
              "Outline the plot for a mystery novel",
              "Write the opening scene of a sci-fi story",
              "Brainstorm plot twists for act 2",
          ],
          video: [
              "Write a script for a 30-second promo video",
              "Create a storyboard description for a short film",
              "Suggest background music styles for a vlog",
              "Outline a video tutorial on cooking",
          ],
          design: [
              "Generate ideas for a game logo",
              "Suggest a color palette for a wellness app",
              "Describe a futuristic city layout",
              "Create a prompt for a character portrait",
          ],
          // Fallback for autonomous/conversation
          conversation: [
              "Help me brainstorm ideas",
              "Explain a complex topic",
              "Write some code for me",
              "Let's just chat",
          ]
      };

      return starters[projectType] || starters['roblox_game'];
  }, [projectType]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            Co-Creator Mode
          </h1>
          <p className="text-lg text-gray-400 mt-4">
              {projectType === 'document' ? "Start writing your document..." : 
               projectType === 'website' ? "Ready to build your web app..." :
               "This chat is empty. Start with a prompt below."}
          </p>
        </div>

        <div>
            <h2 className="text-xl font-semibold text-center mb-6">Prompt Starters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {promptStarters.map((prompt, index) => (
                    <motion.button
                        key={index}
                        onClick={() => onSendMessage(prompt)}
                        className="p-4 bg-bg-secondary border border-bg-tertiary rounded-lg text-left hover:bg-bg-tertiary transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <p className="text-gray-300">{prompt}</p>
                    </motion.button>
                ))}
            </div>
        </div>
      </motion.div>
    </div>
  );
};
