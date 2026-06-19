import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, MessageCircle, MessageSquare, AlertCircle, Trash2, X } from 'lucide-react';
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
  unread_count?: number;
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
    unread_count: conversation.unread_count || 0,
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
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Live ref of the open conversation so socket handlers don't capture stale state
  const selectedConversationRef = useRef<Conversation | null>(null);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

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
          const sel = selectedConversationRef.current;
          const isViewing =
            sel && (sel.id === message.conversation_id || sel.other_user.id === otherId);

          if (isViewing) {
            // User is viewing this conversation: mark read on the server,
            // then re-sync the local + navbar badge accurately.
            api.getConversation(otherId, 50, 0)
              .catch(() => {})
              .finally(() => {
                loadUnreadCount();
                window.dispatchEvent(new Event('messages:read'));
              });
            setConversations(prev =>
              prev.map(c => (c.id === message.conversation_id ? { ...c, unread_count: 0 } : c))
            );
          } else {
            setUnreadCount(prev => Math.max(0, prev + 1));
            setConversations(prev =>
              prev.map(c =>
                c.id === message.conversation_id
                  ? { ...c, unread_count: (c.unread_count || 0) + 1 }
                  : c
              )
            );
          }
        }
      });

      const unsubscribeRead = on('message:read', (data: { message_id: string }) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === data.message_id ? { ...msg, is_read: true } : msg
          )
        );
      });

      // The other participant deleted the conversation — remove it locally too.
      const unsubscribeDeleted = on('conversation:deleted', (data: { conversation_id: string }) => {
        if (!data?.conversation_id) return;
        setConversations(prev => prev.filter(c => c.id !== data.conversation_id));
        setSelectedConversation(prev => {
          if (prev && prev.id === data.conversation_id) {
            setMessages([]);
            return null;
          }
          return prev;
        });
        loadUnreadCount();
        window.dispatchEvent(new Event('messages:read'));
      });

      return () => {
        unsubscribeNew();
        unsubscribeRead();
        unsubscribeDeleted();
      };
    }
  }, [socket, currentUser?.id, on, upsertConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling fallback to keep messages and conversations in sync when WebSocket is offline
  useEffect(() => {
    const pollInterval = setInterval(() => {
      // 1. Refresh unread badge count
      loadUnreadCount();
      
      // 2. Refresh conversations list (to get new messages/conversations in sidebar)
      api.getConversations().then(convs => {
        const safeConversations = (convs || [])
          .map(normalizeConversation)
          .filter((c): c is Conversation => Boolean(c));
        
        setConversations(prev => {
          const isSame = prev.length === safeConversations.length &&
            prev.every((c, i) => c.id === safeConversations[i].id && 
                                c.last_message === safeConversations[i].last_message && 
                                c.last_message_at === safeConversations[i].last_message_at &&
                                (c.unread_count || 0) === (safeConversations[i].unread_count || 0));
          return isSame ? prev : safeConversations;
        });
      }).catch(err => console.error('[Messaging Polling] Failed to fetch conversations:', err));

      // 3. Refresh current conversation messages if one is selected
      if (selectedConversation) {
        if (!selectedConversation.id.startsWith('temp-')) {
          api.getConversation(selectedConversation.other_user.id, 50, 0).then(response => {
            const newMsgs = response.messages || [];
            setMessages(prev => {
              const isSame = prev.length === newMsgs.length &&
                prev.every((m, i) => m.id === newMsgs[i].id && m.content === newMsgs[i].content && m.is_read === newMsgs[i].is_read);
              return isSame ? prev : newMsgs;
            });
          }).catch(err => console.error('[Messaging Polling] Failed to fetch messages:', err));
        }
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [selectedConversation]);

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
      // Opening a conversation marks its messages read on the server.
      // Re-sync the local pill and the global navbar badge so stale
      // "X unread" counts clear immediately, and clear this conversation's
      // sidebar badge.
      setConversations(prev =>
        prev.map(c => (c.id === conversation.id ? { ...c, unread_count: 0 } : c))
      );
      loadUnreadCount();
      window.dispatchEvent(new Event('messages:read'));
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

  const confirmDeleteConversation = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      // Temp (not-yet-persisted) conversations only exist locally.
      if (!target.id.startsWith('temp-')) {
        await api.deleteConversation(target.other_user.id);
      }

      setConversations(prev => prev.filter(c => c.id !== target.id));

      // Clear the message pane if the deleted conversation was open.
      setSelectedConversation(prev => {
        if (
          prev &&
          (prev.id === target.id || prev.other_user.id === target.other_user.id)
        ) {
          setMessages([]);
          return null;
        }
        return prev;
      });

      setDeleteTarget(null);
      loadUnreadCount();
      window.dispatchEvent(new Event('messages:read'));
    } catch (err: any) {
      console.error('[Messaging] Failed to delete conversation:', err);
      setError(getFriendlyMessageError(err, 'Failed to delete conversation'));
    } finally {
      setDeleting(false);
    }
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
                <div
                  key={conversation.id}
                  className={`relative group border-b border-[#E8E3DA] ${
                    selectedConversation?.other_user.id === conversation.other_user.id ? 'bg-[#EDF4EF] border-l-4 border-l-[#4E9A6F]' : ''
                  }`}
                >
                  <button
                    onClick={() => handleSelectConversation(conversation)}
                    className="w-full text-left p-3 pr-10 hover:bg-[#F7F5F0] transition-colors"
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
                      {(conversation.unread_count || 0) > 0 && (
                        <span className="flex-shrink-0 bg-[#4E9A6F] text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center">
                          {(conversation.unread_count || 0) > 99 ? '99+' : conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(conversation); }}
                    className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-lg text-[#7A7570] hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    title="Delete conversation"
                    aria-label={`Delete conversation with ${conversation.other_user.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E8E3DA] w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E3DA]">
              <h3 className="font-semibold text-[#1C1C1C] flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" /> Delete conversation
              </h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="text-[#7A7570] hover:text-[#1C1C1C] disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#5A5550]">
                Delete your conversation with{' '}
                <span className="font-semibold text-[#1C1C1C]">{deleteTarget.other_user.name}</span>?
                This permanently removes all messages for both participants and cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 bg-[#F7F5F0] border-t border-[#E8E3DA]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#5A5550] hover:bg-[#E8E3DA]/60 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteConversation}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
