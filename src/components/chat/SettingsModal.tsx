import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { X, Key, Palette, Moon, Sun, Plus, Trash2, Loader2 } from 'lucide-react';
import { API_CONFIG, detectApiProvider } from '../../services/api';
import { toast } from 'sonner';

export function SettingsModal() {
    const {
        setIsSettingsOpen,
        theme,
        setTheme,
        apiList,
        removeApiKey
    } = useAppStore();

    // Left sidebar active tab: 'api' | 'appearance'
    const [activeTab, setActiveTab] = useState<'api' | 'appearance'>('api');

    // Add API logic
    const [showAddModal, setShowAddModal] = useState(false);
    const [newKeyInput, setNewKeyInput] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    const handleVerifyAndAdd = async () => {
        if (!newKeyInput.trim()) {
            toast.error('请输入 API Key');
            return;
        }
        setIsVerifying(true);
        try {
            const detectedProvider = await detectApiProvider(newKeyInput.trim());
            const config = API_CONFIG[detectedProvider];

            useAppStore.getState().addApiKey({
                key: newKeyInput.trim(),
                provider: detectedProvider,
                models: config.models
            });

            toast.success(`识别成功！已归档 [${config.name}] 凭据`);
            setShowAddModal(false);
            setNewKeyInput('');
        } catch (error: any) {
            toast.error(error.message || '凭证盲测失败，未匹配到可用服务商，请检查余额或网络环境。');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleDeleteKey = (id: string, providerName: string) => {
        if (window.confirm(`确认要删除该 ${providerName} 的 API 凭证吗？此操作不可恢复。`)) {
            removeApiKey(id);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Modal Container */}
            <div className="flex w-[800px] h-[600px] bg-card rounded-xl shadow-2xl overflow-hidden ring-1 ring-border animate-in zoom-in-95 duration-200">

                {/* Left Sidebar */}
                <div className="w-[200px] bg-muted/30 border-r flex flex-col p-4 shrink-0">
                    <h2 className="text-sm font-semibold text-muted-foreground mb-4 px-2">设置中心</h2>
                    <nav className="flex flex-col gap-1">
                        <button
                            onClick={() => setActiveTab('api')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'api' ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-foreground/80'}`}
                        >
                            <Key className="h-4 w-4" />
                            API 管理
                        </button>
                        <button
                            onClick={() => setActiveTab('appearance')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'appearance' ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-foreground/80'}`}
                        >
                            <Palette className="h-4 w-4" />
                            外观设定
                        </button>
                    </nav>
                </div>

                {/* Right Content Area */}
                <div className="flex-1 flex flex-col relative overflow-hidden bg-background">
                    <div className="flex items-center justify-between p-4 border-b shrink-0">
                        <h3 className="text-lg font-semibold">
                            {activeTab === 'api' ? 'API 凭据资产' : '视觉与主题'}
                        </h3>
                        <button
                            onClick={() => setIsSettingsOpen(false)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                            title="关闭"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <div>
                                    <label className="text-sm font-medium block mb-2">应用主题模式</label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setTheme('light')}
                                            className={`flex flex-col items-center justify-center gap-2 w-32 h-24 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                        >
                                            <Sun className="h-6 w-6" />
                                            <span className="text-sm">浅色 (Light)</span>
                                        </button>
                                        <button
                                            onClick={() => setTheme('dark')}
                                            className={`flex flex-col items-center justify-center gap-2 w-32 h-24 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                        >
                                            <Moon className="h-6 w-6" />
                                            <span className="text-sm">深色 (Dark)</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'api' && (
                            <div className="flex flex-col h-full">
                                {/* 台账表格 */}
                                <div className="border rounded-md overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted text-muted-foreground text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">API 凭据内容</th>
                                                <th className="px-4 py-3 font-medium border-x">服务提供商</th>
                                                <th className="px-4 py-3 font-medium">可用模型集</th>
                                                <th className="px-4 py-3 font-medium text-right border-l">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {apiList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                                        暂无已配置的 API 凭据，请点击下方添加
                                                    </td>
                                                </tr>
                                            ) : (
                                                apiList.map((record) => {
                                                    const config = API_CONFIG[record.provider];
                                                    const maskedKey = record.key.length > 10 ? record.key.substring(0, 6) + '****' + record.key.substring(record.key.length - 4) : '****';
                                                    return (
                                                        <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                                                            <td className="px-4 py-3 font-mono text-xs opacity-80">
                                                                {maskedKey}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium border-x">
                                                                {config?.name || record.provider}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {record.models.map((m) => (
                                                                        <span key={m} className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-secondary-foreground truncate max-w-[120px]" title={m}>
                                                                            {m}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right border-l">
                                                                <button
                                                                    onClick={() => handleDeleteKey(record.id, config?.name || record.provider)}
                                                                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                                    title="删除凭证"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* 右下角添加按钮 */}
                                <div className="mt-auto pt-6 flex justify-end">
                                    <button
                                        onClick={() => setShowAddModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-95"
                                    >
                                        <Plus className="h-4 w-4" />
                                        添加新 API 凭证
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 子级弹窗：添加 API 凭据 */}
            {showAddModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-card w-[400px] rounded-xl shadow-2xl p-6 border ring-1 ring-border">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-base">录入并验证 API 凭据</h4>
                            <button
                                onClick={() => { setShowAddModal(false); setNewKeyInput(''); }}
                                className="text-muted-foreground hover:bg-muted p-1 rounded-md transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">
                            只需直接粘贴 sk- 起源的密钥，核心探测器将为您在云端盲测，自动映射归集对应品牌与管辖群阵模型。
                        </p>
                        <input
                            type="password"
                            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                            value={newKeyInput}
                            onChange={(e) => setNewKeyInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleVerifyAndAdd();
                            }}
                            className="w-full border rounded-lg p-2.5 text-sm mb-6 outline-none focus:ring-2 focus:border-primary font-mono bg-background"
                            disabled={isVerifying}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setShowAddModal(false); setNewKeyInput(''); }}
                                disabled={isVerifying}
                                className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                            >
                                放弃
                            </button>
                            <button
                                onClick={handleVerifyAndAdd}
                                disabled={isVerifying || !newKeyInput.trim()}
                                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                            >
                                {isVerifying ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> 嗅探中...</>
                                ) : (
                                    '下发探测校验'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
