import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { demoSets } from './demoData';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

interface ChatState {
    sessionsData: Record<string, Message[]>;

    // Helper to get messages for a specific session
    getMessages: (sessionId: string | null) => Message[];

    // Actions
    addMessage: (sessionId: string, message: Message) => void;
    updateMessage: (sessionId: string, messageId: string, content: string) => void;
    clearMessages: (sessionId: string) => void;

    // Demo / Dev
    loadDemoChat: (sessionId: string, demoIndex: number) => void;
    resetChat: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set, get) => ({
            sessionsData: {},

            getMessages: (sessionId) => {
                if (!sessionId) return [];
                return get().sessionsData[sessionId] || [];
            },

            addMessage: (sessionId, message) => set((state) => {
                const current = state.sessionsData[sessionId] || [];
                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: [...current, message]
                    }
                };
            }),

            updateMessage: (sessionId, messageId, content) => set((state) => {
                const current = state.sessionsData[sessionId] || [];
                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: current.map(msg =>
                            msg.id === messageId ? { ...msg, content } : msg
                        )
                    }
                };
            }),

            clearMessages: (sessionId) => set((state) => ({
                sessionsData: {
                    ...state.sessionsData,
                    [sessionId]: []
                }
            })),

            loadDemoChat: (sessionId, demoIndex) => set((state) => ({
                sessionsData: {
                    ...state.sessionsData,
                    [sessionId]: demoSets[demoIndex].messages
                }
            })),

            resetChat: (sessionId) => set((state) => {
                const newData = { ...state.sessionsData };
                delete newData[sessionId];
                return { sessionsData: newData };
            }),
        }),
        {
            name: 'yuliu-chat-sessions-storage',
            partialize: (state) => ({
                sessionsData: state.sessionsData,
            }),
        }
    )
);
