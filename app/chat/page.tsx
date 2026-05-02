'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Send, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  clearChatMemory,
  getChatMemory,
  saveChatMemoryMessage,
} from '@/lib/firestore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        'Assalamu alaikum! I\'m Lex, your Pakistan-aware legal mentor. I can help you with questions about the Constitution of Pakistan, Pakistan Penal Code (PPC), Criminal Procedure Code (CrPC), and other aspects of Pakistani law. How can I assist you today?',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadMemory = async () => {
      if (!user) return;

      setMemoryLoading(true);
      try {
        const savedMessages = await getChatMemory(user.uid, 20);
        if (savedMessages.length > 0) {
          setMessages(
            savedMessages.map((savedMessage) => ({
              id: savedMessage.id,
              role: savedMessage.role,
              content: savedMessage.content,
              timestamp: savedMessage.createdAt.toDate(),
            }))
          );
        }
      } catch (memoryError) {
        console.error('Error loading chat memory:', memoryError);
      } finally {
        setMemoryLoading(false);
      }
    };

    if (!authLoading && user) {
      loadMemory();
    }
  }, [user, authLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);
    setError('');

    const conversationHistory = messages
      .filter((message) => message.id !== '1')
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    try {
      // Call the backend API to get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({
          message: inputValue,
          context: 'Pakistani Law',
          history: conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Failed to get response from AI (${response.status})`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (user) {
        await Promise.all([
          saveChatMemoryMessage(user.uid, 'user', userMessage.content),
          saveChatMemoryMessage(user.uid, 'assistant', assistantMessage.content),
        ]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error getting response';
      setError(errorMessage);
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-serif text-gray-900">Lex</h1>
              <p className="text-xs text-gray-500">Pakistan-Aware Legal Mentor</p>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-md lg:max-w-xl px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-900 rounded-bl-none'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-indigo-100' : 'text-gray-600'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-md lg:max-w-xl px-4 py-3 rounded-lg bg-gray-200 text-gray-900 rounded-bl-none">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm">Lex is thinking...</p>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Input Form */}
        <Card className="p-4">
          <form onSubmit={handleSendMessage} className="flex items-end gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me about Pakistani law..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
            />
            <Button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </Card>

        {/* Memory Section */}
        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Memory</h2>
              <p className="text-xs text-gray-500">Previous messages remembered for this account</p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={memoryLoading || loading || !user}
              onClick={async () => {
                if (!user) return;
                setMemoryLoading(true);
                try {
                  await clearChatMemory(user.uid);
                  setMessages([
                    {
                      id: '1',
                      role: 'assistant',
                      content:
                        'Assalamu alaikum! I\'m Lex, your Pakistan-aware legal mentor. I can help you with questions about the Constitution of Pakistan, Pakistan Penal Code (PPC), Criminal Procedure Code (CrPC), and other aspects of Pakistani law. How can I assist you today?',
                      timestamp: new Date(),
                    },
                  ]);
                } finally {
                  setMemoryLoading(false);
                }
              }}
            >
              Clear Memory
            </Button>
          </div>

          {memoryLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading memory...
            </div>
          ) : messages.filter((message) => message.id !== '1').length === 0 ? (
            <p className="text-sm text-gray-500">No saved conversation yet.</p>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {messages
                .filter((message) => message.id !== '1')
                .slice(-6)
                .map((message) => (
                  <div key={message.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        {message.role}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                      {message.content}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* Info Box */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
          <p className="font-semibold mb-2">💡 Lex can help with:</p>
          <ul className="space-y-1 text-xs">
            <li>• Constitution of Pakistan (1973, as amended)</li>
            <li>• Pakistan Penal Code (PPC)</li>
            <li>• Criminal Procedure Code (CrPC)</li>
            <li>• General legal queries about Pakistani law</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
