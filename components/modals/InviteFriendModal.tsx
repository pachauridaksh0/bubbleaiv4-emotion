
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, UserPlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Profile } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { getFriendships, addChatParticipant } from '../../services/databaseService';
import { useToast } from '../../hooks/useToast';

interface InviteFriendModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatId: string;
}

export const InviteFriendModal: React.FC<InviteFriendModalProps> = ({ isOpen, onClose, chatId }) => {
    const { user, supabase } = useAuth();
    const { addToast } = useToast();
    const [friends, setFriends] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isInviting, setIsInviting] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            const fetchFriends = async () => {
                setIsLoading(true);
                try {
                    const friendships = await getFriendships(supabase, user.id);
                    setFriends(friendships.map(f => f.other_user));
                } catch (e) {
                    console.error("Failed to fetch friends", e);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchFriends();
        }
    }, [isOpen, user, supabase]);

    const handleInvite = async (friend: Profile) => {
        setIsInviting(true);
        try {
            await addChatParticipant(supabase, chatId, friend.id);
            addToast(`${friend.roblox_username} added to the chat!`, "success");
            onClose();
        } catch (error: any) {
            const msg = error.message || "Failed to add friend.";
            addToast(msg, "error");
        } finally {
            setIsInviting(false);
        }
    };

    const filteredFriends = friends.filter(f => 
        f.roblox_username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="w-full max-w-md bg-bg-secondary border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-bg-tertiary">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserPlusIcon className="w-5 h-5 text-primary-start" />
                                Bring a Friend
                            </h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4">
                            <div className="relative mb-4">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search friends..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-start"
                                />
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-1">
                                {isLoading ? (
                                    <div className="text-center py-4 text-gray-500">Loading friends...</div>
                                ) : filteredFriends.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500">No friends found.</div>
                                ) : (
                                    filteredFriends.map(friend => (
                                        <div key={friend.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors">
                                            <div className="flex items-center gap-3">
                                                <img 
                                                    src={friend.avatar_url || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23334155'/%3E%3Cpath d='M50 42 C61.046 42 70 50.954 70 62 L30 62 C30 50.954 38.954 42 50 42 Z' fill='white'/%3E%3Ccircle cx='50' cy='30' r='10' fill='white'/%3E%3C/svg%3E`}
                                                    alt={friend.roblox_username} 
                                                    className="w-8 h-8 rounded-full bg-bg-tertiary object-cover" 
                                                />
                                                <span className="text-sm font-medium text-white">{friend.roblox_username}</span>
                                            </div>
                                            <button
                                                onClick={() => handleInvite(friend)}
                                                disabled={isInviting}
                                                className="px-3 py-1.5 text-xs font-semibold bg-primary-start text-white rounded-md hover:bg-primary-start/80 transition-colors disabled:opacity-50"
                                            >
                                                Invite
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
