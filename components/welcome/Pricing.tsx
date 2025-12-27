
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const pricingTiers = [
    { name: "Free", price: "$0", description: "Perfect for getting started.", features: ["Daily Credits", "Autonomous Agent", "Standard Models"], popular: false },
    { name: "Pro", price: "$10", description: "For power users.", features: ["More Credits", "Co-Creator Mode", "Pro Models", "Priority Support"], popular: true },
    { name: "Max", price: "$25", description: "For serious builders.", features: ["Maximum Credits", "All Pro Features", "Team Access", "Early Access"], popular: false }
];

export const Pricing: React.FC<{ onAuthClick: () => void }> = ({ onAuthClick }) => (
    <section id="pricing" className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400">Start for free, upgrade when you're ready.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 items-start">
            {pricingTiers.map((tier, index) => (
                <motion.div
                    key={index}
                    className={`relative p-8 bg-bg-secondary border rounded-3xl flex flex-col ${tier.popular ? 'border-primary-start shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-105 z-10' : 'border-white/10 bg-white/5'}`}
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                    {tier.popular && <div className="absolute top-0 right-0 py-1.5 px-4 bg-primary-start text-white text-xs font-bold uppercase tracking-wider rounded-bl-xl rounded-tr-2xl">Most Popular</div>}
                    
                    <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-4xl font-bold text-white">{tier.price}</span>
                        <span className="text-sm text-gray-500">/month</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-8">{tier.description}</p>
                    
                    <ul className="space-y-4 mb-8 flex-1">
                        {tier.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                <CheckCircleIcon className={`w-5 h-5 ${tier.popular ? 'text-primary-start' : 'text-gray-500'}`} />
                                {feature}
                            </li>
                        ))}
                    </ul>
                    
                    <button 
                        onClick={onAuthClick} 
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${tier.popular ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                        Get Started
                    </button>
                </motion.div>
            ))}
        </div>
    </section>
);
