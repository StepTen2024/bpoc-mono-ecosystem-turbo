'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Send, FileCheck, Zap, BookOpen, ChevronRight, History, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { FormattedAIResponse } from '@/components/hr/FormattedAIResponse';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sources?: any[];
  relatedArticles?: string[];
}

const EXAMPLE_QUESTIONS = [
  'What is the legal probationary period?',
  'What are valid grounds for termination?',
  'What are regularization requirements?',
  'What employment records must we maintain?',
  'What are employer obligations for benefits?'
];

export default function RecruiterHRAssistantPage() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (user) {
      loadConversationHistory();
    }
  }, [user]);

  async function loadConversationHistory() {
    try {
      if (!session) return;

      const response = await fetch(
        `/api/hr-assistant/history?role=recruiter`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const historicalMessages: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            type: msg.message_type,
            content: msg.content,
            sources: msg.sources ? JSON.parse(msg.sources) : undefined,
            relatedArticles: msg.related_articles
          }));
          setMessages(historicalMessages);
          setSessionId(data.messages[0]?.session_id || null);
        }
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSubmit(e?: React.FormEvent, directQuestion?: string) {
    if (e) e.preventDefault();
    
    // Use direct question if provided (from predefined questions), otherwise use input
    const questionText = directQuestion || input;
    if (!questionText.trim() || loading || !user || !session) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: questionText
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/hr-assistant/ask', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          question: questionText, 
          role: 'recruiter',
          sessionId 
        })
      });

      if (!response.ok) throw new Error('Failed to get answer');

      const data = await response.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        sources: data.sources,
        relatedArticles: data.relatedArticles
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setSessionId(null);
  }

  if (loadingHistory) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading conversation history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex-none border-b border-white/10 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 px-8 py-6">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30">
              <FileCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                Labor Law Compliance
              </h1>
              <p className="text-sm text-gray-300 flex items-center gap-2 mt-1">
                <Zap className="w-4 h-4 text-orange-400" />
                Philippine Labor Code • Hiring & Compliance Guide
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {messages.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-300 bg-white/10 px-4 py-2 rounded-lg border border-white/20">
                  <History className="w-4 h-4" />
                  {messages.length} messages
                </div>
                <button
                  onClick={clearChat}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 bg-white/10 hover:bg-red-500/10 px-4 py-2 rounded-lg border border-white/20 hover:border-red-500/30 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 bg-[#0B0B0D]">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pt-12"
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 mb-6 shadow-lg shadow-orange-500/20">
                  <BookOpen className="w-12 h-12 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Your Compliance Partner</h2>
                <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                  Get instant answers about hiring requirements, employee obligations & compliance with Philippine labor law.
                </p>
              </div>

              <div className="grid gap-4 max-w-3xl mx-auto">
                {EXAMPLE_QUESTIONS.map((question, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => handleSubmit(undefined, question)}
                    disabled={loading}
                    className="group w-full text-left px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:border-orange-500/50 hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-amber-500/10 transition-all duration-300 shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start gap-4">
                      <ChevronRight className="w-6 h-6 text-orange-400 mt-1 group-hover:translate-x-2 transition-transform" />
                      <span className="text-base text-gray-200 group-hover:text-white transition-colors font-medium">
                        {question}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-3xl px-6 py-5 ${
                    message.type === 'user'
                      ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-xl shadow-orange-500/30'
                      : 'bg-white/10 border border-white/10 text-gray-100 backdrop-blur-xl shadow-lg'
                  }`}
                >
                  <FormattedAIResponse content={message.content} accentColor="orange" />

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-white/20">
                      <p className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Legal References:
                      </p>
                      <div className="space-y-2">
                        {message.sources.map((source: any, idx: number) => (
                          <div key={idx} className="text-sm bg-orange-500/10 rounded-xl px-4 py-3 border border-orange-500/20">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">
                                {source.article ? `Article ${source.article}` : source.section}
                              </span>
                              <span className="text-amber-300 font-mono font-bold">
                                {source.similarity}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.relatedArticles && message.relatedArticles.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold text-amber-400">Related: </span>
                        {message.relatedArticles.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white/10 border border-orange-500/20 rounded-3xl px-6 py-5 backdrop-blur-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                  <span className="text-gray-300">Checking compliance requirements...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex-none border-t border-white/10 bg-white/5 backdrop-blur-xl px-8 py-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about hiring requirements, compliance, employee obligations..."
              disabled={loading || !user}
              className="flex-1 px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 disabled:opacity-50 transition-all"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || !user}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-2xl hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 flex items-center gap-3 font-semibold text-base"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Ask
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Philippine Labor Code • Compliance & Hiring Requirements
          </p>
        </form>
      </div>
    </div>
  );
}
