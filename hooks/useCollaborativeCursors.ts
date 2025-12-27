
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface CursorPosition {
    x: number;
    y: number;
    user: string;
    color: string;
    userId: string;
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98FB98', '#DDA0DD'];

export const useCollaborativeCursors = (projectId: string) => {
    const { supabase, user, profile } = useAuth();
    const [cursors, setCursors] = useState<Record<string, CursorPosition>>({});
    const myColor = useRef(COLORS[Math.floor(Math.random() * COLORS.length)]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user || !supabase || !projectId) return;

        const channel = supabase.channel(`project-cursors:${projectId}`, {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const newCursors: Record<string, CursorPosition> = {};
                
                Object.keys(newState).forEach(key => {
                    if (key === user.id) return; // Skip own cursor
                    const presence = newState[key][0] as any;
                    if (presence && presence.x !== undefined && presence.y !== undefined) {
                        newCursors[key] = {
                            x: presence.x,
                            y: presence.y,
                            user: presence.user,
                            color: presence.color,
                            userId: key
                        };
                    }
                });
                setCursors(newCursors);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Initial track
                    await channel.track({
                        user: profile?.roblox_username || 'Anonymous',
                        color: myColor.current,
                        x: 0,
                        y: 0,
                    });
                }
            });

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            
            const rect = containerRef.current.getBoundingClientRect();
            // Calculate relative position (0-100%)
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;

            if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
                channel.track({
                    user: profile?.roblox_username || 'Anonymous',
                    color: myColor.current,
                    x,
                    y,
                });
            }
        };

        // Throttle updates? For now, raw JS event
        const throttledMove = (e: MouseEvent) => {
            requestAnimationFrame(() => handleMouseMove(e));
        };

        if (containerRef.current) {
            containerRef.current.addEventListener('mousemove', throttledMove);
        }

        return () => {
            if (containerRef.current) {
                containerRef.current.removeEventListener('mousemove', throttledMove);
            }
            supabase.removeChannel(channel);
        };
    }, [projectId, user, supabase, profile]);

    return { cursors, containerRef };
};
