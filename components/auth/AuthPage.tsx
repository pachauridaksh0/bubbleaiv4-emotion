
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon, CheckCircleIcon, ArrowLeftIcon, ArrowRightIcon, CpuChipIcon, MicrophoneIcon, UserGroupIcon, LockClosedIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../../contexts/AuthContext';

type AuthStep = 'email' | 'password';

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
        s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24
        s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657
        C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
        c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238
        C43.021,36.251,44,30.686,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
);

const AppleIcon = () => (
    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-.98-.45-2.07-.48-3.08 0-1.25.57-2.18.3-3.08-.6H7.8c-2.3-2.6-2.5-7.3 1.3-9.1 1.7-.8 2.9-.6 4 .7 1.1 1.3 2.1 1.3 3.3.4.6-.4 1.1-.9 1.6-1.2 1.3-.9 2.5-.7 3.5.7-.9.5-1.7 1.3-2.3 2.2-1.1 1.9-.3 4.2 1.6 5.2-.2 1.3-.5 2.5-.9 3.5zM12.05 7c.2-1.8 1.5-3.3 3.4-3.6.2 1.8-1.4 3.4-3.4 3.6z"/>
    </svg>
);

const GitHubIcon = () => (
    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12c0-5.523-4.477-10-10-10z"/>
    </svg>
);

const FeatureCard: React.FC<{ icon: React.ReactNode, title: string, desc: string, delay: number }> = ({ icon, title, desc, delay }) => (
    <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay, duration: 0.5 }}
        className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors"
    >
        <div className="p-3 bg-gradient-to-br from-primary-start to-primary-end rounded-lg text-white shadow-lg">
            {icon}
        </div>
        <div>
            <h3 className="font-bold text-white text-lg">{title}</h3>
            <p className="text-sm text-gray-300 leading-relaxed mt-1">{desc}</p>
        </div>
    </motion.div>
);

export const AuthPage: React.FC = () => {
  const { signInWithGoogle, signInWithPassword, signUpWithEmail, resetPassword } = useAuth();
  
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email) return;

    if (step === 'email') {
        setStep('password');
    } else {
        await handleAuthAction();
    }
  };

  const handleBack = () => {
      setStep('email');
      setAuthError(null);
  };

  const handleAuthAction = async () => {
    if (!email.trim() || !password.trim() || isAuthLoading) return;

    setIsAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
        if (isSignUp) {
            await signUpWithEmail(email, password);
            setAuthSuccess('Account created! Please verify your email.');
        } else {
            await signInWithPassword(email, password);
        }
    } catch (error: any) {
        let msg = error.message || 'Authentication failed.';
        
        // Custom Error Mapping for Better User Experience
        if (msg.includes("User already registered") || msg.includes("already exists")) {
            // Specifically handle the "User Exists" case during signup
            msg = "This email is already registered. Please log in instead.";
            setIsSignUp(false); // Switch to login mode automatically for convenience
        } else if (msg.includes("Invalid login credentials") || msg.includes("Invalid Refresh Token")) {
            // Handle wrong password/email during login
            msg = "Incorrect email or password.";
        } else if (msg.includes("Error sending confirmation email") || msg.includes("Internal Server Error")) {
            // Handle Supabase rate limits/server errors
            msg = "Email service error: You may have hit the hourly signup limit. Please try again later or check your spam folder.";
        }
        
        setAuthError(msg);
    } finally {
        setIsAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
      if (!email) {
          setAuthError("Please enter your email address first.");
          return;
      }
      try {
          await resetPassword(email);
          setAuthSuccess("Password reset email sent. It may take a few minutes.");
      } catch (e: any) {
          setAuthError(e.message);
      }
  }

  // Auto-login logic for the secret admin button
  const handleSecretAdminLogin = async () => {
      setIsAuthLoading(true);
      setAuthError(null);
      const adminEmail = 'dakshpachauri245@gmail.com';
      const adminPass = '11223344';
      
      try {
          // Pre-fill states for UI consistency
          setEmail(adminEmail);
          setPassword(adminPass);
          
          await signInWithPassword(adminEmail, adminPass);
      } catch (error) {
          setAuthError("Admin Login failed: " + (error as Error).message);
          setIsAuthLoading(false);
      }
  };

  const dynamicTitle = isSignUp ? "Create an Account" : "Welcome Back";
  const dynamicSubtitle = isSignUp ? "Enter your email to get started." : "Enter your email to continue to Bubble.";

  return (
    <div className="flex w-full max-w-6xl h-[85vh] bg-[#0a0a0a] rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
        {/* LEFT SIDE - ENHANCED VISUALS */}
        <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-black">
            {/* Animated Mesh Gradient Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0a0a0a] to-[#0a0a0a] animate-pulse" style={{ animationDuration: '8s' }}></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[100%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/30 via-transparent to-transparent animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
                <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-[80px]"></div>
            </div>
            
            {/* Glassmorphism Pattern Overlay */}
            <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="relative z-10"
            >
                <div className="flex items-center gap-3 mb-6">
                    <span className="text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">🫧</span>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 tracking-wide">Bubble AI</h1>
                </div>
                <p className="text-xl text-gray-300 font-light leading-relaxed max-w-md drop-shadow-md">
                    Access the world's most capable AI workspace. Designed for builders, dreamers, and doers.
                </p>
            </motion.div>

            <div className="relative z-10 space-y-4 my-8">
                <FeatureCard 
                    delay={0.2}
                    icon={<CpuChipIcon className="w-6 h-6" />}
                    title="Advanced Models"
                    desc="Orchestrating Gemini, Claude, Llama, and Advanced Reasoning Engines."
                />
                <FeatureCard 
                    delay={0.4}
                    icon={<MicrophoneIcon className="w-6 h-6" />}
                    title="Neural Voice"
                    desc="Low-latency, emotive voice interactions for hands-free creation."
                />
                <FeatureCard 
                    delay={0.6}
                    icon={<UserGroupIcon className="w-6 h-6" />}
                    title="Co-Creator"
                    desc="Collaborative agents that plan, code, and design alongside you."
                />
            </div>

            <div className="relative z-10 flex items-center gap-4 text-xs text-gray-500 font-mono">
                <span>v3.5.0-stable</span>
                <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                <span>Secure Encryption</span>
            </div>
        </div>

        {/* RIGHT SIDE - AUTH FORM */}
        <div className="w-full lg:w-1/2 bg-[#121212] relative flex flex-col justify-center p-8 md:p-16">
            <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-md mx-auto w-full"
            >
                {step === 'email' ? (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">{dynamicTitle}</h2>
                            <p className="text-gray-400">{dynamicSubtitle}</p>
                        </div>

                        <div className="flex gap-4 p-1 bg-white/5 rounded-lg border border-white/5">
                            <button 
                                type="button"
                                onClick={() => setIsSignUp(false)}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isSignUp ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                            >
                                Log In
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsSignUp(true)}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isSignUp ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                            >
                                Sign Up
                            </button>
                        </div>

                        <form onSubmit={handleNext} className="space-y-6">
                            <div className="space-y-3">
                                <button 
                                    type="button"
                                    onClick={signInWithGoogle} 
                                    className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white text-black rounded-xl font-semibold hover:bg-gray-200 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    <GoogleIcon />
                                    <span>Continue with Google</span>
                                </button>
                                
                                {showMoreOptions ? (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="space-y-3 pt-2"
                                    >
                                        <button type="button" className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-[#24292e] text-white rounded-xl font-semibold hover:bg-[#2f363d] transition-all">
                                            <GitHubIcon />
                                            <span>Continue with GitHub</span>
                                        </button>
                                        <button type="button" className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-black border border-white/20 text-white rounded-xl font-semibold hover:bg-white/10 transition-all">
                                            <AppleIcon />
                                            <span>Continue with Apple</span>
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={handleSecretAdminLogin}
                                            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-red-900/20 border border-red-500/30 text-red-300 rounded-xl font-semibold hover:bg-red-900/40 transition-all"
                                        >
                                            <LockClosedIcon className="w-5 h-5" />
                                            <span>Secret Admin Login</span>
                                        </button>
                                    </motion.div>
                                ) : (
                                    <button 
                                        type="button"
                                        onClick={() => setShowMoreOptions(true)}
                                        className="w-full py-2 text-sm text-gray-500 hover:text-white transition-colors"
                                    >
                                        More Options
                                    </button>
                                )}
                                
                                <div className="relative flex items-center py-2">
                                    <div className="flex-grow border-t border-white/10"></div>
                                    <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">or</span>
                                    <div className="flex-grow border-t border-white/10"></div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2 ml-1">Email Address</label>
                                    <input 
                                        type="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="name@company.com" 
                                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-start focus:border-transparent transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={!email}
                                className="w-full py-4 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary-start/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                            >
                                Continue
                                <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </button>
                        </form>
                        
                        <p className="text-center text-sm text-gray-500">
                            By continuing, you agree to our Terms and Privacy Policy.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <button onClick={handleBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
                            <ArrowLeftIcon className="w-4 h-4" /> Back
                        </button>

                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">{isSignUp ? 'Set Password' : 'Enter Password'}</h2>
                            <p className="text-gray-400">
                                {isSignUp ? 'Create a secure password for your new account.' : `Welcome back, ${email}`}
                            </p>
                        </div>

                        <form onSubmit={handleNext} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2 ml-1">Password</label>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" 
                                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-start focus:border-transparent transition-all"
                                    autoFocus
                                />
                                {!isSignUp && (
                                    <div className="flex justify-end mt-2">
                                        <button type="button" onClick={handleForgotPassword} className="text-xs text-primary-start hover:text-white transition-colors">Forgot password?</button>
                                    </div>
                                )}
                            </div>

                            <button 
                                type="submit" 
                                disabled={isAuthLoading || !password}
                                className="w-full py-4 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary-start/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isAuthLoading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    isSignUp ? 'Create Account' : 'Log In'
                                )}
                            </button>
                        </form>
                    </div>
                )}

                <AnimatePresence>
                    {authError && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-300"
                        >
                            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm font-medium">{authError}</span>
                        </motion.div>
                    )}
                    {authSuccess && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-300"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-medium">{authSuccess}</span>
                            </div>
                            <p className="text-xs text-green-400/80 ml-8">
                                Note: Email delivery may take a few minutes. Please check your spam folder.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    </div>
  );
};
