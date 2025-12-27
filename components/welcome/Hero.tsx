
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, UserIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

export const Hero: React.FC<{ onAuthClick: () => void }> = ({ onAuthClick }) => {
    const { continueAsGuest } = useAuth();
    
    return (
     <motion.section 
        initial="hidden"
        animate="visible"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2 }}}}
        className="relative text-center max-w-5xl mx-auto pt-48 pb-32 min-h-screen flex flex-col justify-center items-center px-4"
    >
        {/* Vibrant Background Glows */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[120px] animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse delay-700"></div>
        </div>

        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}} className="mb-6">
            <span className="px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-blue-300 backdrop-blur-md shadow-lg shadow-blue-500/20">
                ✨ V4.0 Now Available
            </span>
        </motion.div>

        <motion.h1
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}}
            className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-6 leading-tight"
        >
            Build the <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-gradient-x drop-shadow-2xl">
                Impossible.
            </span>
        </motion.h1>
        
        <motion.p 
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}}
            className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed"
        >
            The intelligent workspace that transforms <span className="text-white font-semibold">ideas</span> into <span className="text-white font-semibold">reality</span>. 
            Code, design, and create with the power of next-gen AI.
        </motion.p>
        
        <motion.div 
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full sm:w-auto"
        >
            <button
                onClick={onAuthClick}
                className="relative px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl hover:shadow-[0_0_40px_rgba(79,70,229,0.5)] hover:scale-105 transition-all duration-300 w-full sm:w-auto overflow-hidden group"
            >
                <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 skew-x-12 -ml-4"></div>
                <span className="relative flex items-center justify-center gap-2">
                    Start Building Free
                    <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
                </span>
            </button>
            
            <button
                onClick={continueAsGuest}
                className="px-8 py-4 text-lg font-bold text-gray-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all w-full sm:w-auto flex items-center justify-center gap-2 backdrop-blur-md"
            >
                <UserIcon className="w-5 h-5" />
                Try Guest Mode
            </button>
        </motion.div>

        {/* Floating UI Elements Decor */}
        <motion.div 
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-32 left-4 md:left-10 hidden lg:block p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl -rotate-6 max-w-xs"
        >
            <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="space-y-2 font-mono text-xs text-gray-400">
                <div className="text-purple-400">const <span className="text-blue-400">future</span> = await <span className="text-yellow-400">build()</span>;</div>
                <div>console.log(<span className="text-green-400">"Done!"</span>);</div>
            </div>
        </motion.div>

        <motion.div 
            animate={{ y: [0, 20, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-32 right-4 md:right-10 hidden lg:block p-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl rotate-6"
        >
            <div className="w-48 h-32 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🎨</span>
            </div>
        </motion.div>
    </motion.section>
    );
};
