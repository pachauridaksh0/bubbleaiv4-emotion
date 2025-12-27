
import React from 'react';
import { motion } from 'framer-motion';

export const Showcase: React.FC = () => (
    <section id="showcase" className="max-w-6xl mx-auto px-4 py-24">
        <motion.div
            className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 md:p-8 shadow-2xl relative overflow-hidden"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
            
            <div className="text-center mb-12 relative z-10">
                <h2 className="text-4xl font-bold text-white mb-4">Your Mission Control</h2>
                <p className="text-lg text-gray-400">A unified interface for all your creative endeavors.</p>
            </div>

            <div className="aspect-video bg-[#121212] rounded-xl border border-white/10 p-2 shadow-inner relative z-10 mx-auto max-w-4xl ring-1 ring-white/5">
                {/* Simulated UI Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-black/40 rounded-t-lg border-b border-white/5 mb-2">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                    </div>
                    <div className="h-2 w-32 bg-white/10 rounded-full"></div>
                </div>

                <div className="h-[calc(100%-40px)] flex gap-4">
                    {/* Sidebar */}
                    <div className="w-1/4 bg-white/5 rounded-lg border border-white/5 p-3 flex flex-col gap-2">
                        <div className="h-8 bg-white/10 rounded w-full mb-4"></div>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-6 bg-white/5 rounded w-full"></div>
                        ))}
                    </div>
                    {/* Main */}
                    <div className="flex-1 bg-white/5 rounded-lg border border-white/5 p-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <div className="w-32 h-32 bg-blue-500 rounded-full blur-[60px]"></div>
                        </div>
                        <div className="h-8 bg-white/10 rounded w-1/3 mb-6"></div>
                        <div className="space-y-3">
                            <div className="h-4 bg-white/5 rounded w-full"></div>
                            <div className="h-4 bg-white/5 rounded w-5/6"></div>
                            <div className="h-4 bg-white/5 rounded w-4/6"></div>
                        </div>
                        
                        <div className="mt-8 p-4 bg-black/40 rounded border border-white/10 font-mono text-xs text-green-400">
                            &gt; Initializing system...<br/>
                            &gt; Loading assets...<br/>
                            &gt; Ready.
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Background Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-primary-start/10 blur-[100px] pointer-events-none"></div>
        </motion.div>
    </section>
);
