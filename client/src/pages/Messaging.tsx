import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, MessageCircle, MessageSquare, AlertCircle } from 'lucide-react';
import { api, userAuth } from '../api';
import { useSocket } from '../hooks/useSocket';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  other_user: {
    id: string;
    name: string;
    type: 'doctor' | 'patient';
    specialization?: string;
  };
  last_message: string;
  last_message_sender: string;
  last_message_at: string;
}

const normalizeConversation = (conversation: Conversation): Conversation | null => {
  if (!conversation?.id || !conversation.other_user?.id || !conversation.other_user?.name) {
    return null;
  }

  return {
    ...conversation,
    last_message: conversation.last_message || '',
    last_message_sender: conversation.last_message_sender || '',
    last_message_at: conversation.last_message_at || new Date().toISOString(),
  };
};

const getFriendlyMessageError = (err: unknown, fallback: string) => {
  const message = err instanceof Error ? err.message : fallback;

  if (/bad gateway|failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Messages are temporarily unavailable. Please try again.';
  }

  return message;
};

export default function Messaging() {
  const currentUser = userAuth.getUser();
  const { socket, on, connected } = useSocket();
  const [searchParams] = useSearchParams();
  const doctorIdFromUrl = searchParams.get('doctor');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialError, setInitialError] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadUnreadCount();
  }, []);

  // Refresh conversations on socket (re)connect to catch missed messages
  useEffect(() => {
    if (!connected) return;
    loadConversations();
    loadUnreadCount();
  }, [connected]);

  // Auto-select doctor conversation if doctor ID is in URL
  useEffect(() => {
    if (doctorIdFromUrl && conversations.length > 0) {
      const doctorConversation = conversations.find(
        conv => conv.other_user.id === doctorIdFromUrl
      );
      if (doctorConversation) {
        handleSelectConversation(doctorConversation);
      }
    } else if (doctorIdFromUrl && conversations.length === 0 && !loading) {
      // If doctor ID in URL but no conversations yet, fetch doctor details to show UI
      api.getPractitioner(doctorIdFromUrl)
        .then(doctor => {
          // Create a temporary conversation object for display
          const tempConversation: Conversation = {
            id: `temp-${doctorIdFromUrl}`,
            other_user: {
              id: doctorIdFromUrl,
              name: doctor.name,
              type: 'doctor',
              specialization: doctor.specialization,
            },
            last_message: '',
            last_message_sender: '',
            last_message_at: new Date().toISOString(),
          };
          setSelectedConversation(tempConversation);
          setMessages([]);
        })
        .catch(err => {
          console.error('Failed to load doctor:', err);
          setError('Doctor not found');
        });
    }
  }, [doctorIdFromUrl, conversations, loading]);

  // Append or update a single conversation in the list (sorted by last_message_at desc)
  const upsertConversation = useCallback((incoming: Partial<Conversation> & { id: string; other_user: Conversation['other_user'] }) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === incoming.id);
      const now = incoming.last_message_at || new Date().toISOString();
      let updated: Conversation[];
      if (idx !== -1) {
        updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          last_message: incoming.last_message ?? updated[idx].last_message,
          last_message_sender: incoming.last_message_sender ?? updated[idx].last_message_sender,
          last_message_at: now,
        };
      } else {
        updated = [...prev, {
          id: incoming.id,
          other_user: incoming.other_user,
          last_message: incoming.last_message || '',
          last_message_sender: incoming.last_message_sender || '',
          last_message_at: now,
        }];
      }
      return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    });
  }, []);

  // Join user room for real-time messages
  useEffect(() => {
    if (socket && currentUser?.id) {
      socket.emit('join:user', currentUser.id);

      // Listen for new messages
      const unsubscribeNew = on('message:new', (message: Message) => {
        console.log('[Socket] Received new message:', message);

        const otherId = message.sender_id === currentUser?.id ? message.receiver_id : message.sender_id;

        // Upsert conversation in sidebar
        upsertConversation({
          id: message.conversation_id,
          other_user: { id: otherId, name: message.sender_name, type: 'doctor' },
          last_message: message.content,
          last_message_sender: message.sender_id,
          last_message_at: message.created_at,
        });

        // Add message to currently-viewed conversation
        setSelectedConversation(prev => {
          if (!prev) return prev;

          const isCurrent =
            prev.id === message.conversation_id ||
            prev.other_user.id === otherId;

          if (isCurrent) {
            setMessages(prevMsgs => {
              // Replace temp message from this sender if found
              if (message.sender_id === currentUser?.id) {
                const tempIdx = prevMsgs.findIndex(
                  m => m.id.startsWith('temp-') && m.content === message.content && m.receiver_id === message.receiver_id
                );
                if (tempIdx !== -1) {
                  const updated = [...prevMsgs];
                  updated[tempIdx] = message;
                  return updated;
                }
              }
              // Deduplicate
              if (prevMsgs.some(m => m.id === message.id)) {
                return prevMsgs;
              }
              return [...prevMsgs, message];
            });

            // Upgrade temp conversation ID to real one
            if (prev.id.startsWith('temp-')) {
              return { ...prev, id: message.conversation_id };
            }
          }
          return prev;
        });

        // Update unread count for received messages
        if (message.receiver_id === currentUser?.id) {
          setUnreadCount(prev => Math.max(0, prev + 1));
        }
      });

      const unsubscribeRead = on('message:read', (data: { message_id: string }) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === data.message_id ? { ...msg, is_read: true } : msg
          )
        );
      });

      return () => {
        unsubscribeNew();
        unsubscribeRead();
      };
    }
  }, [socket, currentUser?.id, on, upsertConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setInitialError('');
      const convs = await api.getConversations();
      const safeConversations = (convs || [])
        .map(normalizeConversation)
        .filter((conversation): conversation is Conversation => Boolean(conversation));
      setConversations(safeConversations);
      if (safeConversations.length > 0 && !doctorIdFromUrl) {
        setSelectedConversation(safeConversations[0]);
        await loadMessages(safeConversations[0]);
      }
    } catch (err: any) {
      console.error('[Messaging] Failed to load conversations:', err);
      const errorMsg = getFriendlyMessageError(err, 'Failed to load conversations');
      setInitialError(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversation: Conversation) => {
    try {
      const response = await api.getConversation(conversation.other_user.id, 50, 0);
      setMessages(response.messages || []);
    } catch (err: any) {
      console.error('[Messaging] Failed to load messages:', err);
      setError(getFriendlyMessageError(err, 'Failed to load messages'));
      setMessages([]);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await api.getUnreadMessageCount();
      setUnreadCount(response.unread_count || 0);
    } catch (err) {
      console.error('[Messaging] Failed to load unread count:', err);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setError('');
    await loadMessages(conversation);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !messageInput.trim()) return;

    const messageContent = messageInput.trim();
    setSending(true);
    setError('');

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_id: currentUser?.id || '',
      sender_name: currentUser?.name || 'You',
      receiver_id: selectedConversation.other_user.id,
      content: messageContent,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);
    setMessageInput('');

    try {
      const sentMessage = await api.sendMessage(
        selectedConversation.other_user.id,
        messageContent
      );
      // Replace temp message with the real one from the API response immediately
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === tempMessage.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = sentMessage;
          return updated;
        }
        return prev;
      });
      // Update conversation sidebar
      upsertConversation({
        id: sentMessage.conversation_id,
        other_user: selectedConversation.other_user,
        last_message: messageContent,
        last_message_sender: currentUser?.id || '',
        last_message_at: sentMessage.created_at,
      });
    } catch (err: any) {
      console.error('[Messaging] Failed to send message:', err);
      setError(err.message || 'Failed to send message');
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">Messages</h1>
          <p className="text-[#7A7570] text-sm mt-1">Connect with your care team</p>
        </div>
        {unreadCount > 0 && (
          <div className="bg-[#EDF4EF] border border-[#C5DDD0] rounded-lg px-3 py-2">
            <p className="text-sm font-semibold text-[#4E9A6F]">{unreadCount} unread</p>
          </div>
        )}
      </div>

      {initialError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 text-sm">Error Loading Messages</h3>
            <p className="text-red-700 text-sm mt-1">{initialError}</p>
            <button
              onClick={() => loadConversations()}
              className="mt-2 text-sm text-[#4E9A6F] hover:text-[#4E9A6F]/80 font-medium underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-1 bg-white rounded-2xl border border-[#E8E3DA] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#E8E3DA]">
            <h2 className="font-semibold text-[#1C1C1C]">Conversations</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3 animate-pulse">
                    <div className="h-4 bg-[#F7F5F0] rounded w-3/4 mb-2" />
                    <div className="h-3 bg-[#F7F5F0] rounded w-full" />
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <MessageCircle className="w-8 h-8 text-[#7A7570] mb-3" />
                <p className="text-sm text-[#7A7570]">No conversations yet</p>
              </div>
            ) : (
              conversations.map(conversation => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={`w-full text-left p-3 border-b border-[#E8E3DA] hover:bg-[#F7F5F0] transition-colors ${
                    selectedConversation?.other_user.id === conversation.other_user.id ? 'bg-[#EDF4EF] border-l-4 border-l-[#4E9A6F]' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#EDF4EF] flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#4E9A6F]">
                      {getInitials(conversation.other_user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1C1C1C] truncate">
                        {conversation.other_user.name}
                      </p>
                      <p className="text-xs text-[#7A7570] truncate mt-1">{conversation.last_message}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E8E3DA] overflow-hidden flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-[#E8E3DA] bg-[#F7F5F0]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#EDF4EF] flex items-center justify-center text-sm font-bold text-[#4E9A6F]">
                    {getInitials(selectedConversation.other_user.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-[#1C1C1C]">
                      {selectedConversation.other_user.name}
                    </p>
                    {selectedConversation.other_user.specialization && (
                      <p className="text-xs text-[#7A7570]">
                        {selectedConversation.other_user.specialization}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <MessageSquare className="w-8 h-8 text-[#E8E3DA] mb-3" />
                    <p className="text-sm text-[#7A7570]">No messages yet</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          msg.sender_id === currentUser?.id
                            ? 'bg-[#4E9A6F] text-white rounded-br-none'
                            : 'bg-[#F7F5F0] text-[#1C1C1C] rounded-bl-none border border-[#E8E3DA]'
                        }`}
                      >
                        <p className="text-sm break-words">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            msg.sender_id === currentUser?.id
                              ? 'text-white/80'
                              : 'text-[#7A7570]'
                          }`}
                        >
                          {formatTime(msg.created_at)}
                          {msg.sender_id === currentUser?.id && msg.is_read && ' ✓'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {error && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="p-4 border-t border-[#E8E3DA] bg-[#F7F5F0]">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Type a message…"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    disabled={sending}
                    className="flex-1 border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent disabled:opacity-50 bg-white"
                  />
                  <button
                    type="submit"
                    disabled={sending || !messageInput.trim()}
                    className="bg-[#4E9A6F] hover:bg-[#4E9A6F]/90 text-white px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <MessageCircle className="w-12 h-12 text-[#E8E3DA] mb-4" />
              <p className="text-[#1C1C1C] font-medium">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
