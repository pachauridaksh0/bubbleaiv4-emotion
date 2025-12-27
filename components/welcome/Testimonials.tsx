
import React from 'react';
import { motion } from 'framer-motion';

const testimonials = [
    { name: "Alex Johnson", role: "Lead Scripter", quote: "Bubble AI has become my indispensable partner. I can prototype ideas in minutes that used to take days.", avatar: "https://randomuser.me/api/portraits/men/32.jpg" },
    { name: "Samantha Bee", role: "Indie Dev", quote: "As a solo dev, I wear many hats. Bubble is my coder, my designer, and my brainstorming buddy.", avatar: "https://randomuser.me/api/portraits/women/44.jpg" },
    { name: "David Chen", role: "Tech Director", quote: "We've integrated Bubble into our team's workflow. The natural language coding is incredibly powerful.", avatar: "https://randomuser.me/api/portraits/men/75.jpg" }
];

export const Testimonials: React.FC = () => (
    <section id="testimonials" className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Loved by Creators</h2>
            <p className="text-gray-400">Join thousands of developers building the future.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, index) => (
                 <motion.div
                    key={index}
                    className="p-8 bg-white/5 border border-white/10 rounded-2xl flex flex-col backdrop-blur-sm relative"
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                >
                    <div className="text-4xl text-primary-start absolute top-4 left-6 opacity-30">"</div>
                    <p className="text-gray-300 flex-grow relative z-10 pt-4 mb-6 italic">{t.quote}</p>
                    <div className="flex items-center gap-4 border-t border-white/5 pt-4">
                        <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full grayscale opacity-80" />
                        <div>
                            <p className="font-bold text-white text-sm">{t.name}</p>
                            <p className="text-xs text-gray-500">{t.role}</p>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    </section>
);
