
import React from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, UserGroupIcon, CpuChipIcon, CodeBracketIcon } from '@heroicons/react/24/outline';

const FeatureIcon: React.FC<{ children: React.ReactNode, color: string }> = ({ children, color }) => (
    <div className={`p-3 rounded-xl border border-white/10 bg-gradient-to-br ${color} shadow-lg mb-4 w-fit`}>
        {children}
    </div>
);

const features = [
  {
    name: 'Autonomous Agent',
    description: "Your go-to AI companion for quick questions, code snippets, and image generation.",
    icon: <SparklesIcon className="w-6 h-6 text-white" />,
    color: "from-blue-500/20 to-cyan-500/20",
    colSpan: "md:col-span-2",
  },
  {
    name: 'Co-Creator Workspace',
    description: "Tackle complex projects with a structured, step-by-step workspace.",
    icon: <UserGroupIcon className="w-6 h-6 text-white" />,
    color: "from-purple-500/20 to-pink-500/20",
    colSpan: "md:col-span-1",
  },
  {
    name: 'Intelligent Memory',
    description: "Remembers your preferences, project details, and conversation history.",
    icon: <CpuChipIcon className="w-6 h-6 text-white" />,
    color: "from-amber-500/20 to-orange-500/20",
    colSpan: "md:col-span-1",
  },
   {
    name: 'Advanced Code Gen',
    description: "Generate production-ready code in Luau, JS, HTML/CSS and more.",
    icon: <CodeBracketIcon className="w-6 h-6 text-white" />,
    color: "from-green-500/20 to-emerald-500/20",
    colSpan: "md:col-span-2",
  },
];

export const Features: React.FC = () => (
    <section id="features" className="max-w-6xl mx-auto px-4 py-24 relative">
        <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Supercharged Capabilities</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">Everything you need to build faster, smarter, and better.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
                <motion.div
                    key={index}
                    className={`relative p-8 bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:bg-white/10 transition-all duration-300 group ${feature.colSpan}`}
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                    <div className="relative z-10">
                        <FeatureIcon color={feature.color}>{feature.icon}</FeatureIcon>
                        <h3 className="text-2xl font-bold text-white mb-3">{feature.name}</h3>
                        <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    </section>
);
