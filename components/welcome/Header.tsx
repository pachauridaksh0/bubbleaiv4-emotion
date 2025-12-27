
import React from 'react';
import { motion } from 'framer-motion';

export const Header: React.FC<{ onAuthClick: () => void }> = ({ onAuthClick }) => {
    const navLinks = ["Features", "Showcase", "Testimonials", "Pricing"];
    
    const handleScrollTo = (id: string) => {
        document.getElementById(id.toLowerCase())?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="fixed top-0 left-0 right-0 p-4 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10"
        >
             <div className="container mx-auto flex justify-between items-center">
                <div className="flex items-center space-x-2.5 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <span className="text-2xl group-hover:animate-spin">🫧</span>
                    <span className="text-xl font-bold tracking-wider text-white group-hover:text-primary-start transition-colors">Bubble</span>
                </div>
                 <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map(link => (
                        <button 
                            key={link} 
                            onClick={() => handleScrollTo(link)} 
                            className="text-sm font-medium text-gray-400 hover:text-white transition-colors relative group"
                        >
                            {link}
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-start transition-all group-hover:w-full"></span>
                        </button>
                    ))}
                 </nav>
                <button
                    onClick={onAuthClick}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-white/10 border border-white/20 rounded-full hover:bg-white/20 hover:scale-105 transition-all shadow-lg shadow-purple-500/20"
                >
                    Sign In
                </button>
             </div>
        </motion.header>
    );
};
