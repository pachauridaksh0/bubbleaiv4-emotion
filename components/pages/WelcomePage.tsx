
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowRightIcon, 
    SparklesIcon, 
    UserGroupIcon, 
    CpuChipIcon, 
    CodeBracketIcon,
    UserIcon,
    QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import { AuthPage } from '../auth/AuthPage';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../../contexts/AuthContext';
import AuroraCanvas from '../ui/AuroraCanvas';

type Page = 'home' | 'features' | 'technology' | 'pricing' | 'help';

const FeatureIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="p-2 bg-white/10 rounded-lg border border-white/15">
        {children}
    </div>
);

const bentoFeatures = [
  {
    id: 'autonomous',
    name: 'Autonomous Agent',
    description: "Your go-to AI companion for quick questions, code snippets, and image generation.",
    icon: <SparklesIcon className="w-6 h-6 text-primary-start" />,
    className: "md:col-span-2",
    background: <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-start/10 to-transparent"></div>
  },
  {
    id: 'cocreator',
    name: 'Co-Creator Workspace',
    description: "Tackle complex projects with a structured, step-by-step workspace.",
    icon: <UserGroupIcon className="w-6 h-6 text-primary-start" />,
    className: "md:col-span-1",
    background: <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-start/10 to-transparent"></div>
  },
  {
    id: 'memory',
    name: 'Intelligent Memory',
    description: "Remembers your preferences, project details, and conversation history.",
    icon: <CpuChipIcon className="w-6 h-6 text-primary-start" />,
    className: "md:col-span-1",
    background: <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-start/10 to-transparent"></div>
  },
   {
    id: 'code-gen',
    name: 'Advanced Code Generation',
    description: "Generate production-ready code in Luau, JS, HTML/CSS and more.",
    icon: <CodeBracketIcon className="w-6 h-6 text-primary-start" />,
    className: "md:col-span-2",
    background: <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-start/10 to-transparent"></div>
  },
];

const testimonials = [
    { name: "Alex Johnson", role: "Lead Scripter @ Dream Games", quote: "Bubble AI has become my indispensable partner. I can prototype ideas in minutes that used to take days. The Co-Creator mode is a game-changer for complex systems.", avatar: "https://randomuser.me/api/portraits/men/32.jpg" },
    { name: "Samantha Bee", role: "Solo Developer & YouTuber", quote: "As a solo dev, I wear many hats. Bubble is my coder, my designer, and my brainstorming buddy. It's accelerated my workflow by at least 10x.", avatar: "https://randomuser.me/api/portraits/women/44.jpg" },
    { name: "David Chen", role: "Technical Director @ Metaverse Studios", quote: "We've integrated Bubble into our team's workflow for rapid iteration. The ability to generate and refine code with natural language is incredibly powerful.", avatar: "https://randomuser.me/api/portraits/men/75.jpg" }
];

const pricingTiers = [
    { name: "Free", price: "$0", description: "For individuals getting started.", features: ["Daily Credit Allowance", "Autonomous Agent", "Standard AI Models", "Community Access"], popular: false },
    { name: "Pro", price: "$10", description: "For professionals and power users.", features: ["Larger Credit Allowance", "Co-Creator Workspace", "Advanced AI Models", "Project Memory", "Priority Support"], popular: true },
    { name: "Max", price: "$25", description: "For teams and advanced creators.", features: ["Highest Credit Allowance", "All Pro Features", "Team Collaboration", "Expert-Level Agents", "Early Access to Features"], popular: false }
];

const faqs = [
    { q: "Is Bubble AI free to use?", a: "Yes, we offer a generous free tier that provides a daily credit allowance, which is enough for most casual users to build and experiment. For more intensive use, our Pro and Max plans offer larger credit allowances and advanced features." },
    { q: "What can I build with Bubble AI?", a: "You can build a wide range of projects, from Roblox games and web applications to presentations and stories. Our specialized agents and workspaces are designed to adapt to your creative needs." },
    { q: "Do I need to know how to code?", a: "While coding knowledge is helpful for complex projects, it's not strictly necessary. You can use natural language to guide the AI, and it will generate the code for you. It's a great way to learn!" },
    { q: "How is my data and privacy handled?", a: "We take your privacy seriously. Your conversations and project data are stored securely. Your API keys are encrypted and only used to communicate with the AI models on your behalf." }
];

const SectionHeader: React.FC<{ title: string, subtitle: string }> = ({ title, subtitle }) => (
    <div className="text-center mb-16 max-w-3xl mx-auto">
        <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-6"
        >
            {title}
        </motion.h2>
        <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-400 leading-relaxed"
        >
            {subtitle}
        </motion.p>
    </div>
);

const HelpPage: React.FC = () => (
    <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="pt-32 pb-20 px-6 max-w-7xl mx-auto"
    >
        <SectionHeader 
            title="Help & Support" 
            subtitle="Everything you need to get the most out of Bubble AI."
        />

        <div className="grid md:grid-cols-2 gap-8 mb-20">
            <div className="p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                <h3 className="text-2xl font-bold text-white mb-4">Getting Started Guide</h3>
                <ol className="space-y-4 text-gray-400 list-decimal pl-5">
                    <li><strong className="text-white">Sign Up:</strong> Create an account or continue as a guest to explore.</li>
                    <li><strong className="text-white">API Keys:</strong> Add your Gemini or OpenRouter API keys in settings for full power.</li>
                    <li><strong className="text-white">Choose a Mode:</strong> Use Autonomous for quick tasks or Co-Creator for big projects.</li>
                    <li><strong className="text-white">Start Building:</strong> Type a prompt like "Create a Roblox obby" or "Make a portfolio website".</li>
                </ol>
            </div>
            
            <div className="p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                <h3 className="text-2xl font-bold text-white mb-4">Common Issues</h3>
                <ul className="space-y-4 text-gray-400">
                    <li className="flex gap-3">
                        <QuestionMarkCircleIcon className="w-6 h-6 text-primary-start flex-shrink-0" />
                        <span><strong>API Key Errors:</strong> Ensure your keys are valid and have credits. Check <a href="https://aistudio.google.com/" className="text-primary-start hover:underline">Google AI Studio</a>.</span>
                    </li>
                    <li className="flex gap-3">
                        <QuestionMarkCircleIcon className="w-6 h-6 text-primary-start flex-shrink-0" />
                        <span><strong>Code Not Generating:</strong> Ensure you are using a model capable of coding (Gemini 2.5 Flash/Pro recommended).</span>
                    </li>
                    <li className="flex gap-3">
                        <QuestionMarkCircleIcon className="w-6 h-6 text-primary-start flex-shrink-0" />
                        <span><strong>Roblox Sync:</strong> Make sure the Bubble Sync plugin is installed and running in Roblox Studio.</span>
                    </li>
                </ul>
            </div>
        </div>

        <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-4">Still need help?</h3>
            <p className="text-gray-400 mb-6">Join our community or contact support directly.</p>
            <div className="flex justify-center gap-4">
                <button className="px-6 py-3 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors">Join Discord</button>
                <button className="px-6 py-3 bg-primary-start rounded-lg text-white hover:bg-primary-start/80 transition-colors">Contact Support</button>
            </div>
        </div>
    </motion.div>
);

const HomePage: React.FC<{ onAuthClick: () => void, onNavigate: (page: Page) => void }> = ({ onAuthClick, onNavigate }) => {
    const { continueAsGuest } = useAuth();
    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex flex-col items-center pt-32 pb-20 px-6 min-h-[80vh] justify-center"
        >
            <div className="max-w-5xl mx-auto text-center relative mb-16">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-start/20 rounded-full blur-[120px] pointer-events-none"
                />
                <motion.button
                    onClick={() => onNavigate('technology')}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 hover:bg-white/10 transition-colors group cursor-pointer"
                >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-bold tracking-wide uppercase text-gray-300 group-hover:text-white transition-colors">Powered by Multi-Model Intelligence</span>
                    <ArrowRightIcon className="w-3 h-3 text-gray-500 group-hover:text-white transition-colors" />
                </motion.button>
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                    className="text-6xl md:text-8xl font-bold tracking-tight text-white mb-8 drop-shadow-2xl"
                >
                    Build the <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-primary-start to-purple-400 animate-shine bg-[length:200%_auto]">Impossible.</span>
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-12"
                >
                    The world's most advanced autonomous workspace. 
                    Co-create games, apps, and stories with an AI that orchestrates the best models for every task.
                </motion.p>
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-6"
                >
                    <button
                        onClick={onAuthClick}
                        className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] hover:scale-105 transition-all duration-300"
                    >
                        Start Creating Now
                        <ArrowRightIcon className="inline-block w-5 h-5 ml-2 -mt-0.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                        onClick={continueAsGuest}
                        className="px-8 py-4 text-white bg-white/5 border border-white/10 rounded-full font-semibold text-lg hover:bg-white/10 transition-all backdrop-blur-md flex items-center gap-2 group"
                    >
                        <UserIcon className="w-5 h-5" />
                        Start as Guest
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );
}

const FeaturesPage: React.FC = () => (
    <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="pt-32 pb-20 px-6 max-w-7xl mx-auto"
    >
        <SectionHeader 
            title="An Agent for Every Task" 
            subtitle="Bubble isn't just a chatbot. It's a suite of specialized AI agents working together to bring your ideas to life."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-32">
            {bentoFeatures.map((feature, index) => (
                <motion.div
                    key={feature.id}
                    className={`relative p-8 bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:bg-white/10 transition-colors ${feature.className}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                >
                    {feature.background}
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6 border border-white/10">
                            {feature.icon}
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">{feature.name}</h3>
                        <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    </motion.div>
);

const TechnologyPage: React.FC = () => (
    <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="pt-32 pb-20 px-6 max-w-7xl mx-auto"
    >
        <SectionHeader 
            title="Limitless Intelligence" 
            subtitle="Bubble AI is model-agnostic. We orchestrate the world's best AI models to solve your specific problems."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 h-full flex flex-col justify-center">
                <h3 className="text-2xl font-bold text-white mb-4">Gemini 3 Pro + Flash</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                    Our core reasoning engine. Gemini 3 Pro provides deep logic and creativity, while Flash ensures lightning-fast responses for chat and simple tasks.
                </p>
                <ul className="space-y-2 text-gray-300">
                    <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-primary-start"/> 2M Token Context Window</li>
                    <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-primary-start"/> Native Multimodal Understanding</li>
                    <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-primary-start"/> Real-time Web Search</li>
                </ul>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 h-full flex flex-col justify-center">
                <h3 className="text-2xl font-bold text-white mb-4">Autonomous Coding Agents</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                    Specialized agents that can plan, architect, and write production-ready code for React, Roblox, and Python.
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-black/20 rounded-lg border border-white/5">
                        <div className="text-primary-start font-mono text-sm mb-1">Architect</div>
                        <div className="text-xs text-gray-500">Plans system structure</div>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg border border-white/5">
                        <div className="text-blue-400 font-mono text-sm mb-1">Builder</div>
                        <div className="text-xs text-gray-500">Writes code & files</div>
                    </div>
                </div>
            </div>
        </div>
    </motion.div>
);

const PricingPage: React.FC<{ onAuthClick: () => void }> = ({ onAuthClick }) => {
    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pt-32 pb-20 px-6 max-w-7xl mx-auto"
        >
            <SectionHeader 
                title="Simple, Transparent Pricing" 
                subtitle="Start for free, then help us decide which premium features to build next."
            />
            <div className="grid md:grid-cols-3 gap-8 items-stretch mb-32">
                {pricingTiers.map((tier, index) => (
                    <motion.div
                        key={index}
                        className={`relative p-8 bg-white/5 border border-white/10 rounded-3xl flex flex-col backdrop-blur-sm overflow-hidden ${tier.popular ? 'border-primary-start ring-1 ring-primary-start/50' : ''}`}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                    >
                        {tier.popular && <div className="absolute top-0 right-0 py-1.5 px-4 bg-primary-start text-white text-sm font-bold rounded-bl-xl">POPULAR</div>}
                        <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
                        <div className="flex items-baseline gap-1 my-6">
                            <span className="text-5xl font-bold text-white">{tier.price}</span>
                            <span className="text-gray-400">/month</span>
                        </div>
                        <p className="text-gray-400 mb-8 h-12">{tier.description}</p>
                        <ul className="space-y-4 mb-8 flex-grow">
                            {tier.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <CheckCircleIcon className="w-5 h-5 text-primary-start flex-shrink-0 mt-0.5" />
                                    <span className="text-gray-300 text-sm">{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <button onClick={onAuthClick} className={`w-full py-4 font-bold rounded-xl transition-all ${tier.popular ? 'bg-primary-start text-white hover:bg-primary-start/80 shadow-lg hover:shadow-primary-start/20' : 'bg-white text-black hover:bg-gray-100'}`}>
                            Get Started
                        </button>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};

const Header: React.FC<{ activePage: Page, onNavigate: (page: Page) => void, onAuthClick: () => void }> = ({ activePage, onNavigate, onAuthClick }) => {
    return (
        <motion.header 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className="fixed top-0 left-0 right-0 z-50 px-6 py-6"
        >
            <div className="max-w-7xl mx-auto bg-black/50 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex justify-between items-center shadow-2xl">
                <div 
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => onNavigate('home')}
                >
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/20 shadow-inner group-hover:bg-white/20 transition-colors">
                        <span className="text-lg">🫧</span>
                    </div>
                    <span className="text-lg font-bold tracking-tight text-white">Bubble AI</span>
                </div>

                <nav className="hidden md:flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5">
                    {(['home', 'features', 'technology', 'pricing', 'help'] as Page[]).map((page) => (
                        <button
                            key={page}
                            onClick={() => onNavigate(page)}
                            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                                activePage === page 
                                ? 'bg-white text-black shadow-sm' 
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {page.charAt(0).toUpperCase() + page.slice(1)}
                        </button>
                    ))}
                </nav>

                <div className="flex gap-3">
                    <button 
                        onClick={onAuthClick}
                        className="hidden sm:block px-5 py-2 text-sm font-semibold text-white hover:text-primary-start transition-colors"
                    >
                        Log In
                    </button>
                    <button 
                        onClick={onAuthClick}
                        className="px-5 py-2 text-sm font-semibold text-white bg-primary-start hover:bg-primary-start/90 rounded-full transition-all hover:scale-105 shadow-lg shadow-primary-start/20"
                    >
                        Get Started
                    </button>
                </div>
            </div>
        </motion.header>
    );
};

const Footer: React.FC<{ onNavigate: (page: Page) => void }> = ({ onNavigate }) => (
    <footer className="w-full py-12 border-t border-white/10 relative z-10 bg-black/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">🫧</span>
                    <span className="text-xl font-bold text-white">Bubble AI</span>
                </div>
                <p className="text-gray-400 max-w-xs">
                    Building the future of autonomous creation. One prompt at a time.
                </p>
                <div className="flex gap-4 mt-6">
                    <div className="w-8 h-8 rounded-full bg-white/10"></div>
                    <div className="w-8 h-8 rounded-full bg-white/10"></div>
                    <div className="w-8 h-8 rounded-full bg-white/10"></div>
                </div>
            </div>
            <div>
                <h4 className="text-white font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                    <li><button onClick={() => onNavigate('features')} className="hover:text-white transition-colors">Features</button></li>
                    <li><button onClick={() => onNavigate('technology')} className="hover:text-white transition-colors">Technology</button></li>
                    <li><button onClick={() => onNavigate('pricing')} className="hover:text-white transition-colors">Pricing</button></li>
                </ul>
            </div>
            <div>
                <h4 className="text-white font-semibold mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                    <li><button onClick={() => onNavigate('help')} className="hover:text-white transition-colors">Help Center</button></li>
                    <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                </ul>
            </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-white/5 text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Bubble AI Inc. All rights reserved.
        </div>
    </footer>
);

export const WelcomePage: React.FC = () => {
  const [isAuthVisible, setAuthVisible] = useState(false);
  const [activePage, setActivePage] = useState<Page>('home');

  const renderContent = () => {
      switch(activePage) {
          case 'home': return <HomePage onAuthClick={() => setAuthVisible(true)} onNavigate={setActivePage} />;
          case 'features': return <FeaturesPage />;
          case 'technology': return <TechnologyPage />;
          case 'pricing': return <PricingPage onAuthClick={() => setAuthVisible(true)} />;
          case 'help': return <HelpPage />;
          default: return <HomePage onAuthClick={() => setAuthVisible(true)} onNavigate={setActivePage} />;
      }
  };
  
  return (
    <div className="relative min-h-screen w-full text-white bg-bg-primary overflow-x-hidden selection:bg-primary-start/30 selection:text-white">
        <AuroraCanvas />
        <div className="absolute inset-0 -z-10 bg-black/40"></div>
        
        <Header activePage={activePage} onNavigate={setActivePage} onAuthClick={() => setAuthVisible(true)} />

        <AnimatePresence mode="wait">
            <motion.main
                key={activePage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="relative z-10"
            >
                {renderContent()}
            </motion.main>
        </AnimatePresence>
        
        <Footer onNavigate={setActivePage} />

        <AnimatePresence>
            {isAuthVisible && (
                <motion.div
                    {...{
                      initial: { opacity: 0 },
                      animate: { opacity: 1 },
                      exit: { opacity: 0 },
                    }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setAuthVisible(false)}
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <AuthPage />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};
