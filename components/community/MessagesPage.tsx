
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, MagnifyingGlassIcon, BellIcon, CheckIcon, XMarkIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { getFriendships, getPendingFriendRequests, updateFriendRequest, getNotifications, getPrivateMessages, sendPrivateMessage } from '../../services/databaseService';
import { Profile, PrivateMessage } from '../../types';
import { useToast } from '../../hooks/useToast';

type Tab = 'chats' | 'notifications';

const FriendItem: React.FC<{ profile: Profile; selected: boolean; onSelect: () => void; }> = ({ profile, selected, onSelect }) => (
    <button
        onClick={onSelect}
        className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${selected ? 'bg-white/10' : 'hover:bg-white/5'}`}
    >
        <img 
            src={profile.avatar_url || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23334155'/%3E%3Cpath d='M50 42 C61.046 42 70 50.954 70 62 L30 62 C30 50.954 38.954 42 50 42 Z' fill='white'/%3E%3Ccircle cx='50' cy='30' r='10' fill='white'/%3E%3C/svg%3E`}
            alt={profile.roblox_username} 
            className="w-10 h-10 rounded-full bg-bg-tertiary object-cover" 
        />
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
                <p className="font-semibold text-white truncate">{profile.roblox_username}</p>
            </div>
            <p className="text-sm text-gray-400 truncate">Click to chat</p>
        </div>
    </button>
);

const MessageBubble: React.FC<{ message: PrivateMessage; isOwn: boolean }> = ({ message, isOwn }) => (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${isOwn ? 'bg-primary-start text-white rounded-tr-sm' : 'bg-white/10 text-gray-200 rounded-tl-sm'}`}>
            <p>{message.content}</p>
            <span className={`text-[10px] block mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    </div>
);

const NotificationItem: React.FC<{ notification: any; onAccept?: (id: string) => void; onDecline?: (id: string) => void }> = ({ notification, onAccept, onDecline }) => {
    const isFriendRequest = notification.type === 'friend_request';
    return (
        <div className={`p-4 border-b border-white/10 ${!notification.read ? 'bg-white/5' : ''}`}>
            <div className="flex gap-3">
                 <div className="mt-1">
                    {isFriendRequest ? <UserPlusIcon className="w-5 h-5 text-primary-start"/> : <BellIcon className="w-5 h-5 text-gray-400"/>}
                 </div>
                 <div className="flex-1">
                    <h4 className="text-sm font-bold text-white">{notification.title}</h4>
                    <p className="text-sm text-gray-300 mt-0.5">
                        {notification.related_user && <span className="font-semibold text-white mr-1">{notification.related_user.roblox_username}</span>}
                        {notification.content}
                    </p>
                    {isFriendRequest && notification.friendship_id && (
                        <div className="flex gap-2 mt-3">
                             <button 
                                onClick={() => onAccept && onAccept(notification.friendship_id)} 
                                className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-md hover:bg-green-500/30 flex items-center gap-1"
                            >
                                <CheckIcon className="w-3 h-3" /> Accept
                             </button>
                             <button 
                                onClick={() => onDecline && onDecline(notification.friendship_id)}
                                className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-md hover:bg-red-500/30 flex items-center gap-1"
                            >
                                <XMarkIcon className="w-3 h-3" /> Decline
                             </button>
                        </div>
                    )}
                 </div>
                 <div className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(notification.created_at).toLocaleDateString()}
                 </div>
            </div>
        </div>
    );
}

interface MessagesPageProps {
    onNavigate?: (path: string) => void;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({ onNavigate }) => {
    const { user, supabase } = useAuth();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<Tab>('chats');
    const [friends, setFriends] = useState<Profile[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
    const [messages, setMessages] = useState<PrivateMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const friendships = await getFriendships(supabase, user.id);
            setFriends(friendships.map(f => f.other_user));

            const dbNotifications = await getNotifications(supabase, user.id);
            const requests = await getPendingFriendRequests(supabase, user.id);
            
            const requestNotifications = requests.map(req => ({
                id: `req-${req.id}`,
                type: 'friend_request',
                title: 'Friend Request',
                content: 'wants to be friends.',
                related_user: req.sender,
                created_at: req.created_at,
                read: false,
                friendship_id: req.id
            }));
            
            const allNotes = [...requestNotifications, ...dbNotifications].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setNotifications(allNotes);

        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user, supabase]);

    // Load Messages & Subscribe when friend selected
    useEffect(() => {
        if (!selectedFriend || !user) return;
        
        let channel: any;

        const loadMessages = async () => {
            try {
                const msgs = await getPrivateMessages(supabase, user.id, selectedFriend.id);
                setMessages(msgs);
                scrollToBottom();
            } catch (e) {
                console.error(e);
                addToast("Failed to load conversation", "error");
            }
        };

        loadMessages();

        // Subscribe to NEW messages involving user
        channel = supabase.channel(`private-chat:${user.id}`)
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'private_messages',
                    filter: `recipient_id=eq.${user.id}`
                }, 
                (payload) => {
                    const newMsg = payload.new as PrivateMessage;
                    // Only add if it belongs to current conversation
                    if (newMsg.sender_id === selectedFriend.id) {
                        setMessages(prev => [...prev, newMsg]);
                        scrollToBottom();
                    } else {
                        addToast(`New message from a friend`, 'info');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedFriend, user, supabase]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputMessage.trim() || !user || !selectedFriend) return;

        const tempMsg: PrivateMessage = {
            id: `temp-${Date.now()}`,
            sender_id: user.id,
            recipient_id: selectedFriend.id,
            content: inputMessage,
            conversation_id: 'temp',
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, tempMsg]);
        setInputMessage('');
        scrollToBottom();

        try {
            await sendPrivateMessage(supabase, user.id, selectedFriend.id, tempMsg.content);
            // We rely on local optimistic update, or refetch if needed.
            // Ideally replace temp with real ID, but for now simple append is fine.
        } catch (e) {
            console.error(e);
            addToast("Failed to send message", "error");
        }
    };

    const handleAccept = async (friendshipId: string) => {
        try {
            await updateFriendRequest(supabase, friendshipId, 'accepted');
            addToast('Friend request accepted!', 'success');
            fetchData();
        } catch (e) {
            addToast('Failed to accept request.', 'error');
        }
    };

    const handleDecline = async (friendshipId: string) => {
        try {
            await updateFriendRequest(supabase, friendshipId, 'blocked'); 
            addToast('Request declined.', 'info');
            fetchData();
        } catch (e) {
            addToast('Failed to decline.', 'error');
        }
    };

    return (
        <div className="h-full flex text-white bg-bg-primary">
            {/* Sidebar List */}
            <aside className="w-full md:w-96 flex-shrink-0 border-r border-border-color bg-bg-secondary flex flex-col">
                <header className="p-4 border-b border-border-color flex-shrink-0 space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold">Social</h1>
                    </div>
                    
                    {/* Tabs */}
                    <div className="flex p-1 bg-bg-tertiary rounded-lg">
                        <button 
                            onClick={() => setActiveTab('chats')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'chats' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Messages
                        </button>
                        <button 
                            onClick={() => setActiveTab('notifications')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'notifications' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Notifications
                             {notifications.length > 0 && <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">{notifications.length}</span>}
                        </button>
                    </div>

                    {activeTab === 'chats' && (
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search friends..."
                                className="w-full bg-bg-primary border border-border-color rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-start"
                            />
                        </div>
                    )}
                </header>
                
                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="flex justify-center py-8"><svg className="animate-spin h-6 w-6 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
                    ) : activeTab === 'chats' ? (
                        friends.length > 0 ? (
                            <div className="space-y-1">
                                {friends.map(profile => (
                                    <FriendItem
                                        key={profile.id}
                                        profile={profile}
                                        selected={selectedFriend?.id === profile.id}
                                        onSelect={() => setSelectedFriend(profile)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 px-4">
                                <p className="text-gray-400 mb-4">You haven't added any friends yet.</p>
                                <button 
                                    onClick={() => onNavigate ? onNavigate('/discover') : window.location.href = '/discover'} 
                                    className="text-primary-start hover:underline text-sm font-medium"
                                >
                                    Find people in Discover
                                </button>
                            </div>
                        )
                    ) : (
                        <div className="space-y-0">
                            {notifications.length > 0 ? (
                                notifications.map((note, i) => (
                                    <NotificationItem 
                                        key={note.id || i} 
                                        notification={note} 
                                        onAccept={handleAccept}
                                        onDecline={handleDecline}
                                    />
                                ))
                            ) : (
                                <div className="text-center py-12 text-gray-500">No new notifications.</div>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex-col hidden md:flex bg-bg-primary h-full overflow-hidden">
                {activeTab === 'chats' && selectedFriend ? (
                    <div className="h-full flex flex-col">
                        <header className="p-4 border-b border-border-color flex items-center gap-3 bg-bg-secondary/50">
                            <img 
                                src={selectedFriend.avatar_url || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23334155'/%3E%3Cpath d='M50 42 C61.046 42 70 50.954 70 62 L30 62 C30 50.954 38.954 42 50 42 Z' fill='white'/%3E%3Ccircle cx='50' cy='30' r='10' fill='white'/%3E%3C/svg%3E`}
                                className="w-8 h-8 rounded-full bg-bg-tertiary object-cover" 
                            />
                            <h2 className="font-bold text-white">{selectedFriend.roblox_username}</h2>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-gray-500 h-full">
                                    <div className="text-center">
                                        <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p>Start a conversation with {selectedFriend.roblox_username}.</p>
                                    </div>
                                </div>
                            ) : (
                                messages.map(msg => (
                                    <MessageBubble 
                                        key={msg.id} 
                                        message={msg} 
                                        isOwn={msg.sender_id === user?.id} 
                                    />
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 bg-bg-secondary/50 border-t border-border-color">
                            <form onSubmit={handleSendMessage} className="relative">
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder={`Message ${selectedFriend.roblox_username}...`}
                                    className="w-full bg-bg-primary border border-border-color rounded-lg pl-4 pr-12 py-3 text-white focus:outline-none focus:ring-1 focus:ring-primary-start"
                                />
                                <button 
                                    type="submit"
                                    disabled={!inputMessage.trim()}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-primary-start hover:text-white transition-colors disabled:opacity-50"
                                >
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </div>
                ) : activeTab === 'chats' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                        <ChatBubbleLeftRightIcon className="w-16 h-16 mb-4 opacity-20" />
                        <h2 className="text-xl font-semibold text-gray-300">Select a Chat</h2>
                        <p>Choose a friend from the sidebar to start messaging.</p>
                        {friends.length === 0 && (
                            <button 
                                onClick={() => onNavigate ? onNavigate('/discover') : window.location.href = '/discover'} 
                                className="mt-4 text-primary-start hover:underline"
                            >
                                Go to Discover
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                        <BellIcon className="w-16 h-16 mb-4 opacity-20" />
                        <h2 className="text-xl font-semibold text-gray-300">Notifications</h2>
                        <p>Manage your friend requests and alerts from the sidebar.</p>
                    </div>
                )}
            </main>
        </div>
    );
};
