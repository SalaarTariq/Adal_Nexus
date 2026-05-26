'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/app/providers';
import { Button } from '@/components/ui/button';
import {
  createChatSession,
  getChatSessions,
  getChatMemory,
  updateChatSession,
  ChatSession,
  ChatMemoryMessage,
} from '@/lib/firestore';
import { ArrowLeft, Loader2, Menu, Plus, Send, X } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SessionItem {
  sessionId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

const WELCOME_MESSAGE_ID = 'welcome-assistant';

const WELCOME_MESSAGE: Message = {
  id: WELCOME_MESSAGE_ID,
  role: 'assistant',
  content:
    "Assalamu alaikum! I'm Lex, your Pakistan-aware legal mentor. Ask me about the Constitution of Pakistan, PPC, CrPC, family law, legal education, and practical legal pathways.",
  timestamp: new Date(),
};

function toDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeDate = (value as { toDate?: () => Date }).toDate;
    if (typeof maybeDate === 'function') {
      return maybeDate();
    }
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date();
}

function truncateTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return 'New Chat';
  return clean.length > 30 ? `${clean.slice(0, 30)}...` : clean;
}

function toLocalSession(session: ChatSession): SessionItem {
  return {
    sessionId: session.sessionId,
    title: session.title || 'New Chat',
    createdAt: toDate(session.createdAt),
    updatedAt: toDate(session.updatedAt),
    messages: (session.messages || []).map((message, index) => ({
      id: `${session.sessionId}-${index}`,
      role: message.role,
      content: message.content,
      timestamp: toDate(message.timestamp),
    })),
  };
}

function mapMemoryMessages(memory: ChatMemoryMessage[]): Message[] {
  return memory.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: toDate(message.createdAt),
  }));
}

export default function ChatbotPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [mode, setMode] = useState<'Student' | 'Professional'>('Student');
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [loadingReply, setLoadingReply] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingReply]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!user) return;

      setLoadingSessions(true);
      setError('');
      try {
        const data = await getChatSessions(user.uid);
        const mapped = data.map(toLocalSession);
        setSessions(mapped);

        if (mapped.length > 0) {
          const latest = mapped[0];
          setActiveSessionId(latest.sessionId);
          setMessages(latest.messages.length > 0 ? latest.messages : [WELCOME_MESSAGE]);
          return;
        }

        const legacyMemory = await getChatMemory(user.uid, 100);
        if (legacyMemory.length > 0) {
          const memoryMessages = mapMemoryMessages(legacyMemory);
          const firstUserMessage = memoryMessages.find((message) => message.role === 'user');
          const title = truncateTitle(firstUserMessage?.content || 'Imported Chat');
          const createdAt = memoryMessages[0]?.timestamp ?? new Date();
          const updatedAt = memoryMessages[memoryMessages.length - 1]?.timestamp ?? new Date();

          const created = await createChatSession(user.uid, title);
          if (created.success && created.sessionId) {
            await updateChatSession(created.sessionId, {
              title,
              messages: memoryMessages.map((message) => ({
                role: message.role,
                content: message.content,
                timestamp: Timestamp.fromDate(message.timestamp),
              })),
            });

            const importedSession: SessionItem = {
              sessionId: created.sessionId,
              title,
              createdAt,
              updatedAt,
              messages: memoryMessages,
            };

            setSessions([importedSession]);
            setActiveSessionId(created.sessionId);
            setMessages(memoryMessages);
            return;
          }
        }

        setActiveSessionId(null);
        setMessages([WELCOME_MESSAGE]);
      } catch (sessionError) {
        console.error('Error loading chat sessions:', sessionError);
        setError('Failed to load chat history.');
      } finally {
        setLoadingSessions(false);
      }
    };

    if (!authLoading && user) {
      loadSessions();
    }
  }, [user, authLoading]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.sessionId === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );

  const startNewChat = async () => {
    if (!user || creatingSession) return;

    setCreatingSession(true);
    setError('');
    try {
      const created = await createChatSession(user.uid);
      if (!created.success || !created.sessionId) {
        throw new Error('Could not create a new chat space');
      }

      const newSession: SessionItem = {
        sessionId: created.sessionId,
        title: 'New Chat',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [WELCOME_MESSAGE],
      };

      setSessions((prev) => [newSession, ...prev.filter((session) => session.sessionId !== created.sessionId)]);
      setActiveSessionId(created.sessionId);
      setMessages([WELCOME_MESSAGE]);
      setInputValue('');
      setSidebarOpen(false);
    } catch (createError) {
      console.error('Error creating new chat session:', createError);
      setError('Failed to start a new chat space.');
    } finally {
      setCreatingSession(false);
    }
  };

  const openSession = (session: SessionItem) => {
    setActiveSessionId(session.sessionId);
    setMessages(session.messages.length > 0 ? session.messages : [WELCOME_MESSAGE]);
    setError('');
    setSidebarOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputValue.trim() || loadingReply) return;

    const rawUserInput = inputValue.trim();
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: rawUserInput,
      timestamp: new Date(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputValue('');
    setLoadingReply(true);
    setError('');

    let sessionId = activeSessionId;
    try {
      if (!sessionId) {
        const created = await createChatSession(user.uid);
        if (!created.success || !created.sessionId) {
          throw new Error('Could not create chat session');
        }

        const newSessionId = created.sessionId;
        sessionId = newSessionId;
        setActiveSessionId(newSessionId);
        setSessions((prev) => [
          {
            sessionId: newSessionId,
            title: 'New Chat',
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [],
          },
          ...prev,
        ]);
      }

      if (!sessionId) {
        throw new Error('Unable to determine chat session');
      }

      const history = nextMessages
        .filter((message) => message.id !== WELCOME_MESSAGE_ID && message.id !== userMessage.id)
        .slice(-20)
        .map((message) => ({ role: message.role, content: message.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          message: rawUserInput,
          mode,
          context: 'Pakistani Law',
          history,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Failed to get AI response (${response.status})`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      };

      const finalMessages = [...nextMessages, assistantMessage];
      setMessages(finalMessages);

      const firstUserMessage = finalMessages.find(
        (message) => message.id !== WELCOME_MESSAGE_ID && message.role === 'user'
      );
      const resolvedTitle =
        activeSession?.title && activeSession.title !== 'New Chat'
          ? activeSession.title
          : truncateTitle(firstUserMessage?.content || 'New Chat');

      await updateChatSession(sessionId, {
        title: resolvedTitle,
        messages: finalMessages
          .filter((message) => message.id !== WELCOME_MESSAGE_ID)
          .map((message) => ({
            role: message.role,
            content: message.content,
            timestamp: Timestamp.fromDate(message.timestamp),
          })),
      });

      setSessions((prev) => {
        const updated = prev.map((session) => {
          if (session.sessionId !== sessionId) return session;
          return {
            ...session,
            title: resolvedTitle,
            updatedAt: new Date(),
            messages: finalMessages.filter((message) => message.id !== WELCOME_MESSAGE_ID),
          };
        });
        return updated.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Error sending message';
      setError(message);
      console.error('Chat send error:', sendError);
    } finally {
      setLoadingReply(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex">
      <aside className="hidden md:flex md:w-[260px] lg:w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Chat spaces</p>
          <Button
            onClick={startNewChat}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={creatingSession}
          >
            <Plus className="h-4 w-4 mr-2" />
            {creatingSession ? 'Starting...' : 'New Chat'}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingSessions ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 px-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading chats...
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-500 px-2 py-3">No previous chats yet.</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.sessionId}
                type="button"
                onClick={() => openSession(session)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                  activeSessionId === session.sessionId
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 line-clamp-1">{session.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {session.updatedAt.toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
              <Button
                onClick={startNewChat}
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={creatingSession}
              >
                <Plus className="h-4 w-4 mr-2" />
                {creatingSession ? 'Starting...' : 'New Chat'}
              </Button>
              <button
                type="button"
                className="p-2 rounded hover:bg-gray-100"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.sessionId}
                  type="button"
                  onClick={() => openSession(session)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                    activeSessionId === session.sessionId
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{session.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {session.updatedAt.toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="shrink-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="md:hidden p-2 rounded hover:bg-gray-100"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5 text-gray-700" />
              </button>
              <Link href="/dashboard" className="p-2 rounded hover:bg-gray-100">
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold font-serif text-gray-900 truncate">
                  Lex - AI Legal Mentor
                </h1>
                <p className="text-xs text-gray-500 truncate">
                  {activeSession ? `Active chat: ${activeSession.title}` : 'Pick an old chat or start a new space'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'Student' | 'Professional')}
                className="hidden sm:block rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="Student">Student</option>
                <option value="Professional">Professional</option>
              </select>
              <Button onClick={startNewChat} variant="outline" className="text-sm" disabled={creatingSession}>
                <Plus className="h-4 w-4 mr-1" />
                {creatingSession ? 'Starting...' : 'New Chat'}
              </Button>
            </div>
          </div>
          <div className="px-4 sm:px-6 py-2 border-t border-gray-100 bg-amber-50 text-amber-900 text-xs sm:text-sm">
            Lex provides educational legal guidance, not formal legal representation. Consult a licensed advocate for case-specific advice.
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-2xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p
                  className={`text-[11px] mt-2 ${
                    message.role === 'user' ? 'text-indigo-100' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {loadingReply && (
            <div className="flex justify-start">
              <div className="max-w-[90%] sm:max-w-2xl rounded-lg px-4 py-3 bg-white border border-gray-200 text-gray-900 rounded-bl-none">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lex is thinking...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white px-4 sm:px-6 py-3">
          {error && <div className="mb-3 text-sm text-red-700 bg-red-50 rounded p-2">{error}</div>}
          <form onSubmit={handleSendMessage} className="flex items-end gap-2 sm:gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about Pakistani law..."
              disabled={loadingReply}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
            />
            <Button
              type="submit"
              disabled={loadingReply || !inputValue.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
