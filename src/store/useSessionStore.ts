import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatSession {
    id: string;
    title: string;
    updatedAt: number;
}

interface SessionState {
    sessions: ChatSession[];
    activeSessionId: string | null;
    sessionCounter: number;

    // Actions
    createSession: (initialTitle?: string) => string;
    deleteSession: (id: string) => void;
    setActiveSession: (id: string) => void;
    updateSessionTitle: (id: string, title: string) => void;
}

export const useSessionStore = create<SessionState>()(
    persist(
        (set) => ({
            sessions: [],
            activeSessionId: null,
            sessionCounter: 0,

            createSession: (initialTitle) => {
                const newId = `session-${Date.now()}`;
                let finalTitle = initialTitle;

                set((state) => {
                    const nextCounter = state.sessionCounter + 1;
                    if (!finalTitle) {
                        finalTitle = `会话 #${nextCounter}`;
                    }

                    return {
                        sessions: [
                            { id: newId, title: finalTitle, updatedAt: Date.now() },
                            ...state.sessions
                        ],
                        activeSessionId: newId,
                        sessionCounter: nextCounter
                    };
                });
                return newId;
            },

            deleteSession: (id) => {
                set((state) => {
                    const newSessions = state.sessions.filter(s => s.id !== id);
                    let newActiveId = state.activeSessionId;

                    // If we deleted the active session, fallback to the latest one if exists
                    if (id === newActiveId) {
                        newActiveId = newSessions.length > 0 ? newSessions[0].id : null;
                    }

                    return {
                        sessions: newSessions,
                        activeSessionId: newActiveId
                    };
                });
            },

            setActiveSession: (id) => {
                set({ activeSessionId: id });
            },

            updateSessionTitle: (id, title) => {
                set((state) => ({
                    sessions: state.sessions.map((s) =>
                        s.id === id ? { ...s, title, updatedAt: Date.now() } : s
                    )
                }));
            }
        }),
        {
            name: 'yuliu-session-storage',
        }
    )
);
