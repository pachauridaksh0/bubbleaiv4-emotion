
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import type { Session, User, SupabaseClient, Provider } from '@supabase/supabase-js';
import { Profile } from '../types';
import { supabase } from '../supabaseClient'; 
import { createProfile as createProfileInDb, updateProfile, getUserProfile } from '../services/databaseService';
import { useToast } from '../hooks/useToast';

const DEV_BYPASS_LOGIN = false;

// The hardcoded super admin email for specific override
const SUPER_ADMIN_EMAIL = 'dakshpachauri245@gmail.com';

interface AuthContextType {
    supabase: SupabaseClient;
    session: Session | null;
    user: User | null;
    profile: Profile | null | undefined; 
    providers: string[];
    loading: boolean;
    geminiApiKey: string | null;
    openRouterApiKey: string | null;
    tavilyApiKey: string | null; 
    scrapingAntApiKey: string | null; 
    isAdmin: boolean;
    isImpersonating: boolean;
    isGuest: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithRoblox: () => Promise<void>; 
    signInWithPassword: (email: string, pass: string) => Promise<void>;
    signUpWithEmail: (email: string, pass: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    continueAsGuest: () => void;
    saveGeminiApiKey: (key: string) => Promise<void>;
    saveOpenRouterApiKey: (key: string) => Promise<void>;
    saveTavilyApiKey: (key: string) => Promise<void>; 
    saveScrapingAntApiKey: (key: string) => Promise<void>; 
    setGeminiApiKey: (key: string | null) => void;
    setOpenRouterApiKey: (key: string | null) => void;
    createProfile: (displayName: string) => Promise<void>;
    updateUserProfile: (updates: Partial<Profile>, fetchAfter?: boolean) => Promise<void>;
    loginAsAdmin: () => void;
    logoutAdmin: () => void;
    impersonateUser: (profileToImpersonate: Profile) => void;
    stopImpersonating: () => void;
    retryAuth: () => void;
    // New Account Linking Methods
    linkGoogleAccount: () => Promise<void>;
    updateUserPassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Guest Profile Mock
const GUEST_PROFILE: Profile = {
    id: 'guest',
    roblox_id: 'guest',
    roblox_username: 'Guest User',
    avatar_url: '',
    credits: 0,
    membership: 'na',
    preferred_chat_model: 'gemini-2.5-flash',
    preferred_image_model: 'nano_banana',
    preferred_code_model: 'gemini-2.5-flash',
    role: 'user',
    ui_theme: 'gray' // Default to Gray Mode
};

const GUEST_USER: User = {
    id: 'guest',
    app_metadata: {},
    user_metadata: {},
    aud: 'guest',
    created_at: new Date().toISOString()
};

// Keys for Local Storage Caching
const CACHE_KEYS = {
    PROFILE_PREFIX: 'bubble_profile_cache_',
    GUEST_SESSION: 'is_guest_session'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addToast } = useToast();
    
    // Initialize state lazily to avoid race conditions
    const [isGuest, setIsGuest] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(CACHE_KEYS.GUEST_SESSION) === 'true';
        }
        return false;
    });

    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(() => isGuest ? GUEST_USER : null);
    const [profile, setProfile] = useState<Profile | null | undefined>(() => isGuest ? GUEST_PROFILE : undefined);
    const [providers, setProviders] = useState<string[]>([]);
    
    // Initial loading state. 
    const [loading, setLoading] = useState<boolean>(!isGuest);
    
    // Check for auth tokens in URL immediately (Hash for Implicit, Search for PKCE)
    const initHash = useRef(typeof window !== 'undefined' ? window.location.hash : '');
    const initSearch = useRef(typeof window !== 'undefined' ? window.location.search : '');
    
    const isMagicLinkLogin = 
        initHash.current.includes('access_token') || 
        initHash.current.includes('type=recovery') || 
        initHash.current.includes('type=signup') ||
        initHash.current.includes('type=invite') ||
        initHash.current.includes('type=magiclink') ||
        initSearch.current.includes('code=');

    const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
    const [openRouterApiKey, setOpenRouterApiKey] = useState<string | null>(null);
    const [tavilyApiKey, setTavilyApiKey] = useState<string | null>(null);
    const [scrapingAntApiKey, setScrapingAntApiKey] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [originalAdminState, setOriginalAdminState] = useState<{ session: Session; user: User; profile: Profile } | null>(null);

    // Simple trigger to force re-running the auth effect
    const [retryTrigger, setRetryTrigger] = useState(0);

    // Apply Theme Effect
    useEffect(() => {
        const root = document.documentElement;
        // Default to gray if undefined
        const theme = profile?.ui_theme || 'gray';

        // 1. Handle Light Mode
        if (theme === 'light') {
            root.classList.remove('dark');
            root.setAttribute('data-theme', 'light');
        } 
        // 2. Handle Dark Mode variations
        else {
            root.classList.add('dark');
            if (theme === 'gray') {
                root.setAttribute('data-theme', 'gray');
            } else if (theme === 'dark') {
                // "Black" mode - remove custom theme attribute
                root.removeAttribute('data-theme');
            } else {
                // Auto/Fallback -> Default to Gray
                root.setAttribute('data-theme', 'gray');
            }
        }
    }, [profile?.ui_theme]);

    // --- SAFETY TIMEOUT FOR MAGIC LINKS ---
    // If we think we are in a magic link flow (hash/query present) but Supabase fails to fire 
    // the auth event within 10 seconds, force stop loading so the user isn't stuck.
    useEffect(() => {
        if (isMagicLinkLogin && loading) {
            const timer = setTimeout(() => {
                if (!user) {
                    console.warn("Magic link timeout - forcing loading completion.");
                    setLoading(false);
                }
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [isMagicLinkLogin, loading, user]);

    // --- CACHE HELPERS ---
    const getCachedProfile = (userId: string): Profile | null => {
        try {
            const cached = localStorage.getItem(CACHE_KEYS.PROFILE_PREFIX + userId);
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            return null;
        }
    };

    const cacheProfile = (profile: Profile) => {
        try {
            localStorage.setItem(CACHE_KEYS.PROFILE_PREFIX + profile.id, JSON.stringify(profile));
        } catch (e) {
            console.warn("Failed to cache profile to local storage", e);
        }
    };

    // --- MAIN AUTH LOGIC ---
    useEffect(() => {
        if (isGuest) {
            if (!user) setUser(GUEST_USER);
            if (!profile) setProfile(GUEST_PROFILE);
            setLoading(false);
            return;
        }

        let mounted = true;

        const initializeAuth = async () => {
            if (originalAdminState) { 
                setLoading(false); 
                return; 
            }

            try {
                // 0. HANDLE OAUTH ERRORS
                const searchParams = new URLSearchParams(window.location.search);
                const error = searchParams.get('error');
                const errorDescription = searchParams.get('error_description');

                if (error) {
                    console.error("Auth Error from URL:", error, errorDescription);
                    addToast(`Login Failed: ${errorDescription || error}`, 'error');
                    window.history.replaceState(null, '', window.location.pathname);
                }

                // 1. Get Session
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
                
                if (sessionError) {
                    const errMsg = sessionError.message || '';
                    // CRITICAL FIX: Handle invalid refresh token by forcing logout
                    if (errMsg.includes("Refresh Token") || errMsg.includes("Invalid Refresh Token")) {
                        console.warn("Session expired or invalid refresh token. Forcing signout.");
                        await supabase.auth.signOut();
                        setSession(null);
                        setUser(null);
                        setProfile(null);
                        setLoading(false);
                        return;
                    } else {
                        console.warn("Session check warning:", sessionError);
                    }
                }

                if (!currentSession) {
                    if (mounted) {
                        setSession(null);
                        setUser(null);
                        setProfile(null);
                        
                        // CRITICAL FIX FOR MAGIC LINKS:
                        // If we detected a magic link hash/query at startup, DO NOT turn off loading yet.
                        // We must wait for Supabase to process the hash and fire the SIGNED_IN event.
                        if (!isMagicLinkLogin) {
                            setLoading(false);
                        } else {
                            console.log("Magic Link detected, waiting for auth event...");
                        }
                    }
                    return;
                }

                // 2. We have a session
                const currentUser = currentSession.user;
                if (mounted) {
                    setSession(currentSession);
                    setUser(currentUser);
                    setProviders(currentUser?.identities?.map(i => i.provider as string) ?? []);
                }

                // CHECK FOR SUPER ADMIN EMAIL OVERRIDE
                const isSuperAdmin = currentUser.email === SUPER_ADMIN_EMAIL;

                // 3. CACHE-FIRST STRATEGY (Non-Blocking)
                const cachedProfile = getCachedProfile(currentUser.id);
                if (cachedProfile && mounted) {
                    setProfile(cachedProfile);
                    setGeminiApiKey(cachedProfile.gemini_api_key || null);
                    setOpenRouterApiKey(cachedProfile.openrouter_api_key || null);
                    setTavilyApiKey(cachedProfile.tavily_api_key || null);
                    setScrapingAntApiKey(cachedProfile.scrapingant_api_key || null);
                    // Override local admin state if super admin email
                    setIsAdmin(isSuperAdmin || cachedProfile.role === 'admin');
                    
                    setLoading(false);
                }

                // 4. Background Sync
                try {
                    const dbProfile = await getUserProfile(supabase, currentUser.id);
                    
                    if (dbProfile && mounted) {
                        setProfile(dbProfile);
                        setGeminiApiKey(dbProfile.gemini_api_key || null);
                        setOpenRouterApiKey(dbProfile.openrouter_api_key || null);
                        setTavilyApiKey(dbProfile.tavily_api_key || null);
                        setScrapingAntApiKey(dbProfile.scrapingant_api_key || null);
                        // Override local admin state if super admin email
                        setIsAdmin(isSuperAdmin || dbProfile.role === 'admin');
                        
                        cacheProfile(dbProfile);
                    } else if (!dbProfile && mounted && !cachedProfile) {
                        setProfile(null); 
                    }
                } catch (dbError) {
                    console.warn("Background profile sync failed (using cache if available):", dbError);
                    if (!cachedProfile && mounted) {
                        setProfile(null);
                    }
                }

            } catch (err: any) {
                console.error("Auth initialization error:", err);
            } finally {
                // Same logic here: don't stop loading if waiting for magic link processing
                if (mounted && !isMagicLinkLogin && session) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setProfile(null);
                setLoading(false);
                if (user) localStorage.removeItem(CACHE_KEYS.PROFILE_PREFIX + user.id);
            } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && newSession) {
                if (user?.id !== newSession.user.id) {
                    initializeAuth();
                } else {
                    setUser(newSession.user);
                    setSession(newSession);
                    // Auth successful, we can stop loading even if it was a magic link
                    setLoading(false);
                }
            } else if (event === 'TOKEN_REFRESHED' && newSession) {
                setSession(newSession);
                setUser(newSession.user);
            } else if (event === 'USER_UPDATED' && newSession) {
                setUser(newSession.user);
                setSession(newSession);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [isGuest, retryTrigger, originalAdminState]);

    const retryAuth = () => {
        setLoading(true);
        setRetryTrigger(prev => prev + 1); 
    };

    const clearGuestSession = () => {
        localStorage.removeItem(CACHE_KEYS.GUEST_SESSION);
        setIsGuest(false);
    };

    const signInWithProvider = async (provider: Provider) => {
        clearGuestSession();
        await supabase.auth.signInWithOAuth({ 
            provider, 
            options: { 
                redirectTo: window.location.origin,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            } 
        });
    };
    const signInWithGoogle = () => signInWithProvider('google');
    const signInWithRoblox = () => signInWithProvider('roblox' as Provider);
    const signInWithPassword = async (email: string, password: string) => {
        clearGuestSession();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (email === SUPER_ADMIN_EMAIL) {
            setIsAdmin(true);
        }
    };
    const signUpWithEmail = async (email: string, password: string) => {
        clearGuestSession();
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
    };
    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
             redirectTo: `${window.location.origin}/update-password`,
        });
        if (error) throw error;
    }
    const signOut = async () => {
        if (!isGuest) await supabase.auth.signOut();
        clearGuestSession();
        setSession(null); setUser(null); setProfile(null); setProviders([]); 
        setGeminiApiKey(null); setOpenRouterApiKey(null); setTavilyApiKey(null); setScrapingAntApiKey(null);
        if (isAdmin) logoutAdmin();
        setLoading(false);
    };

    const continueAsGuest = () => {
        localStorage.setItem(CACHE_KEYS.GUEST_SESSION, 'true');
        setIsGuest(true);
        setUser(GUEST_USER);
        setProfile(GUEST_PROFILE);
        setLoading(false);
    };

    const linkGoogleAccount = async () => {
        if (isGuest || !user) return;
        const { data, error } = await supabase.auth.linkIdentity({ provider: 'google' });
        if (error) throw error;
    };

    const updateUserPassword = async (password: string) => {
        if (isGuest || !user) return;
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        addToast("Password set successfully. You can now login with email.", "success");
    };
    
    const saveGeminiApiKey = async (key: string) => {
        if (isGuest) {
            setGeminiApiKey(key);
            return;
        }
        if (!user || !profile) throw new Error("User not authenticated.");
        
        const updatedProfile = { ...profile, gemini_api_key: key };
        setGeminiApiKey(key);
        setProfile(updatedProfile);
        cacheProfile(updatedProfile); 
        
        try {
            await updateProfile(supabase, user.id, { gemini_api_key: key });
        } catch (e) {
            console.warn("Failed to save API key to DB, but saved locally.", e);
        }
    };

    const saveOpenRouterApiKey = async (key: string) => {
        if (isGuest) {
            setOpenRouterApiKey(key);
            return;
        }
        if (!user || !profile) throw new Error("User not authenticated.");
        
        const updatedProfile = { ...profile, openrouter_api_key: key };
        setOpenRouterApiKey(key);
        setProfile(updatedProfile);
        cacheProfile(updatedProfile);

        try {
            await updateProfile(supabase, user.id, { openrouter_api_key: key });
        } catch (e) {
            console.warn("Failed to save API key to DB, but saved locally.", e);
        }
    };

    const saveTavilyApiKey = async (key: string) => {
        if (!user || !profile) return;
        const updatedProfile = { ...profile, tavily_api_key: key };
        setTavilyApiKey(key);
        setProfile(updatedProfile);
        cacheProfile(updatedProfile);
        try {
            await updateProfile(supabase, user.id, { tavily_api_key: key });
        } catch(e) {}
    };

    const saveScrapingAntApiKey = async (key: string) => {
        if (!user || !profile) return;
        const updatedProfile = { ...profile, scrapingant_api_key: key };
        setScrapingAntApiKey(key);
        setProfile(updatedProfile);
        cacheProfile(updatedProfile);
        try {
            await updateProfile(supabase, user.id, { scrapingant_api_key: key });
        } catch(e) {}
    };

    const createProfile = async (displayName: string) => {
        if (!user) throw new Error("User not authenticated.");
        setLoading(true);
        try {
            const newProfile = await createProfileInDb(supabase, user.id, displayName, user.user_metadata.avatar_url || '');
            setProfile(newProfile);
            cacheProfile(newProfile);
        } finally { setLoading(false); }
    };

    const updateUserProfile = async (updates: Partial<Profile>, fetchAfter: boolean = true) => {
        if (isGuest) {
            setProfile(prev => ({ ...(prev || GUEST_PROFILE), ...updates }));
            return;
        }
        if (!user || !profile) throw new Error("User not authenticated.");
        
        const optimisticProfile = { ...profile, ...updates };
        setProfile(optimisticProfile);
        cacheProfile(optimisticProfile);

        try {
            const updatedDbProfile = await updateProfile(supabase, user.id, updates);
            if (fetchAfter) {
                setProfile(prev => ({ ...(prev || {}), ...updatedDbProfile }));
                cacheProfile({ ...optimisticProfile, ...updatedDbProfile });
            }
        } catch (e) {
            console.error("Failed to sync profile update to DB", e);
            addToast("Saved locally. Will sync when online.", "info");
        }
    };

    const loginAsAdmin = () => { sessionStorage.setItem('isAdmin', 'true'); setIsAdmin(true); };
    const logoutAdmin = () => { sessionStorage.removeItem('isAdmin'); setIsAdmin(false); };
    
    const impersonateUser = (profileToImpersonate: Profile) => {
        if (!isAdmin || !session || !user || !profile) return;
        setOriginalAdminState({ session, user, profile });
        const impersonatedUser: User = { ...user, id: profileToImpersonate.id, email: `impersonating@bubble.ai`, user_metadata: { ...user.user_metadata, name: profileToImpersonate.roblox_username, avatar_url: profileToImpersonate.avatar_url }};
        const impersonatedSession: Session = { ...session, user: impersonatedUser };
        setSession(impersonatedSession); 
        setUser(impersonatedUser); 
        setProfile(profileToImpersonate); 
        setGeminiApiKey(profileToImpersonate.gemini_api_key || null); 
        setOpenRouterApiKey(profileToImpersonate.openrouter_api_key || null);
        setTavilyApiKey(profileToImpersonate.tavily_api_key || null);
        setScrapingAntApiKey(profileToImpersonate.scrapingant_api_key || null);
        setIsAdmin(false);
    };
    const stopImpersonating = () => {
        if (!originalAdminState) return;
        setSession(originalAdminState.session); 
        setUser(originalAdminState.user); 
        setProfile(originalAdminState.profile); 
        setGeminiApiKey(originalAdminState.profile.gemini_api_key || null); 
        setOpenRouterApiKey(originalAdminState.profile.openrouter_api_key || null);
        setTavilyApiKey(originalAdminState.profile.tavily_api_key || null);
        setScrapingAntApiKey(originalAdminState.profile.scrapingant_api_key || null);
        setOriginalAdminState(null); 
        setIsAdmin(true);
    };

    const value: AuthContextType = { 
        supabase, session, user, profile, providers, loading, 
        geminiApiKey, openRouterApiKey, tavilyApiKey, scrapingAntApiKey, isAdmin, isGuest,
        isImpersonating: originalAdminState !== null, 
        signInWithGoogle, signInWithRoblox, signInWithPassword, signUpWithEmail, resetPassword, signOut, continueAsGuest,
        saveGeminiApiKey, saveOpenRouterApiKey, saveTavilyApiKey, saveScrapingAntApiKey,
        setGeminiApiKey, setOpenRouterApiKey, 
        createProfile, updateUserProfile, loginAsAdmin, logoutAdmin, impersonateUser, stopImpersonating,
        retryAuth,
        linkGoogleAccount, updateUserPassword
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within a AuthProvider');
    return context;
};
