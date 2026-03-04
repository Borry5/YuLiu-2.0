import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { type ApiProviderType } from '../services/api';

export interface ApiKeyRecord {
    id: string;
    key: string;
    provider: ApiProviderType;
    models: string[]; // 用户勾选/获取的该管家下的有效模型
}

interface AppState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;

    apiList: ApiKeyRecord[];
    addApiKey: (record: Omit<ApiKeyRecord, 'id'>) => void;
    removeApiKey: (id: string) => void;
    updateApiKey: (id: string, record: Partial<Omit<ApiKeyRecord, 'id'>>) => void;

    // 当前选用的发送通道标识 (取代旧的 apiProvider/apiKey)
    activeModelConfig: {
        apiKeyId: string;
        provider: ApiProviderType;
        model: string;
    } | null;
    setActiveModelConfig: (config: AppState['activeModelConfig']) => void;

    isSettingsOpen: boolean;
    setIsSettingsOpen: (open: boolean) => void;

    isSearchEnabled: boolean;
    setSearchEnabled: (enabled: boolean) => void;

    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
}

const defaultDeepSeekKey = 'sk-2832dc576a2c4750bbf9a5015013e32e';

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            isSidebarOpen: true,
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

            apiList: [
                {
                    id: 'default-deepseek-001',
                    key: defaultDeepSeekKey,
                    provider: 'deepseek',
                    models: ['deepseek-chat', 'deepseek-reasoner'] // 预设模型
                }
            ],
            addApiKey: (record) => set((state) => ({
                apiList: [...state.apiList, { ...record, id: crypto.randomUUID() }]
            })),
            removeApiKey: (id) => set((state) => {
                const newList = state.apiList.filter(item => item.id !== id);
                return {
                    apiList: newList,
                    // If the active activeModelConfig was utilizing this deleted key, drop it
                    activeModelConfig: state.activeModelConfig?.apiKeyId === id ? (
                        newList.length > 0 ? {
                            apiKeyId: newList[0].id,
                            provider: newList[0].provider,
                            model: newList[0].models[0] || ''
                        } : null
                    ) : state.activeModelConfig
                };
            }),
            updateApiKey: (id, record) => set((state) => ({
                apiList: state.apiList.map(item => item.id === id ? { ...item, ...record } : item)
            })),

            activeModelConfig: {
                apiKeyId: 'default-deepseek-001',
                provider: 'deepseek',
                model: 'deepseek-chat'
            },
            setActiveModelConfig: (config) => set({ activeModelConfig: config }),

            isSettingsOpen: false,
            setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),

            isSearchEnabled: false,
            setSearchEnabled: (enabled) => set({ isSearchEnabled: enabled }),

            theme: 'light',
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: 'yuliu-app-storage-v4', // bumping version to avoid conflicts
            partialize: (state) => ({
                apiList: state.apiList,
                activeModelConfig: state.activeModelConfig,
                isSearchEnabled: state.isSearchEnabled,
                theme: state.theme
            }),
        }
    )
);
