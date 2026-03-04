import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;

    apiKey: string;
    setApiKey: (key: string) => void;

    apiProvider: 'deepseek' | 'siliconflow';
    setApiProvider: (provider: 'deepseek' | 'siliconflow') => void;

    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            isSidebarOpen: true,
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

            apiKey: '',
            setApiKey: (key: string) => set({ apiKey: key }),
            apiProvider: 'deepseek',
            setApiProvider: (provider: 'deepseek' | 'siliconflow') => set({ apiProvider: provider }),

            theme: 'light',
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: 'yuliu-app-storage',
            partialize: (state) => ({
                apiKey: state.apiKey,
                apiProvider: state.apiProvider,
                theme: state.theme
            }),
        }
    )
);
