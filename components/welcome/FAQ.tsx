
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const faqs = [
    { q: "Is Bubble AI free to use?", a: "Yes, we offer a generous free tier that provides a daily credit allowance." },
    { q: "What can I build?", a: "Everything from Roblox games and web apps to documents and presentations." },
    { q: "Do I need to know code?", a: "Not at all. You can use natural language, and Bubble will generate the code for you." },
    { q: "Is my data secure?", a: "Yes, we take privacy seriously and encrypt your data." }
];

const FaqItem: React.FC<{ q: string, a: string }> = ({ q, a }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-white/10 last:border-0">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center text-left py-6 group">
                <span className="text-lg font-medium text-white group-hover:text-primary-start transition-colors">{q}</span>
                <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <p className="text-gray-400 pb-6 leading-relaxed">{a}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const FAQ: React.FC = () => (
    <section id="faq" className="max-w-3xl mx-auto px-4 py-24">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
        </div>
        <div className="bg-white/5 rounded-3xl p-8 border border-white/10">
            {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
        </div>
    </section>
);
