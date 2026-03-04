import { type Message } from '../store/useChatStore';

interface StreamChatParams {
    messages: Message[];
    apiKey: string;
    provider: 'deepseek' | 'siliconflow';
    onChunk: (content: string) => void;
    onFinish: () => void;
    onError: (error: Error) => void;
}

const API_CONFIG = {
    deepseek: {
        url: 'https://api.deepseek.com/chat/completions',
        model: 'deepseek-chat',
    },
    siliconflow: {
        url: 'https://api.siliconflow.cn/v1/chat/completions', // Hypothetical URL, user needs to verify
        model: 'deepseek-ai/DeepSeek-V3', // Example model
    }
};

export async function streamChat({ messages, apiKey, provider, onChunk, onFinish, onError }: StreamChatParams) {
    try {
        const config = API_CONFIG[provider];

        // Prepare messages for API (remove id and timestamp, keep role and content)
        const apiMessages = messages.map(({ role, content }) => ({ role, content }));

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: apiMessages,
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        if (!response.body) throw new Error('Response body is null');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    if (dataStr === '[DONE]') {
                        onFinish();
                        return;
                    }

                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices[0]?.delta?.content || '';
                        if (content) {
                            accumulatedContent += content;
                            onChunk(accumulatedContent);
                        }
                    } catch (e) {
                        console.warn('Error parsing JSON chunk', e);
                    }
                }
            }
        }

        onFinish();

    } catch (error) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
    }
}

// Verify API Key with a lightweight test request
export async function verifyApiKey(apiKey: string, provider: 'deepseek' | 'siliconflow'): Promise<{ success: boolean; message: string }> {
    try {
        const config = API_CONFIG[provider];

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1, // Minimal tokens to reduce cost
            }),
        });

        if (response.ok) {
            return { success: true, message: 'API Key 验证成功！' };
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || response.statusText || `HTTP ${response.status}`;
            return { success: false, message: `验证失败: ${errorMsg}` };
        }
    } catch (error) {
        return { success: false, message: `网络错误: ${error instanceof Error ? error.message : '未知错误'}` };
    }
}

// Generate a concise title for the session based on first interaction
export async function generateSessionTitle(
    apiKey: string,
    provider: 'deepseek' | 'siliconflow',
    userContent: string,
    aiContent: string
): Promise<string | null> {
    try {
        const config = API_CONFIG[provider];
        const prompt = `请根据以下用户的输入和 AI 的回答，总结出一个极其简短、凝炼的会话标题。
要求：
1. 不超过 10 个字。
2. 不要加任何标点符号。
3. 不要包含"关于"、"的讨论"等冗余词汇。
4. 直接输出标题文本本身，不要其他任何格式。

用户输入：${userContent.substring(0, 300)}
AI回答：${aiContent.substring(0, 300)}
`;

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 15,
                temperature: 0.5,
            }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const title = data.choices?.[0]?.message?.content?.trim() || '';
        return title ? title.replace(/['"]/g, '') : null;
    } catch (error) {
        console.error('Error generating session title:', error);
        return null;
    }
}
