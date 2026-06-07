import { useState, useEffect, useRef } from 'react';
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

export default function Messaging() {
  const currentUser = userAuth.getUser();
  const { socket, on } = useSocket();
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

  // Auto-select doctor conversation if doctor ID is in URL
  useEffect(() => {
    if (doctorIdFromUrl && conversations.length > 0) {
      const doctorConversation = conversations.find(
        conv => conv.other_user.id === doctorIdFromUrl
      );
      if (doctorConversation) {
        handleSelectConversation(doctorConversation);
      }
    } else if (doctorIdFromUrl && conversations.length === 0) {
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
  }, [doctorIdFromUrl, conversations]);

  // Join user room for real-time messages
  useEffect(() => {
    if (socket && currentUser?.id) {
      socket.emit('join:user', currentUser.id);

      // Listen for new messages
      const unsubscribeNew = on('message:new', (message: Message) => {
        console.log('[Socket] Received new message:', message);
        
        // Update conversations list
        setConversations(prev =>
          prev.map(conv =>
            conv.id === message.conversation_id
              ? {
                  ...conv,
                  last_message: message.content,
                  last_message_sender: message.sender_id,
                  last_message_at: message.created_at,
                }
              : conv
          )
        );

        // Add to current conversation if it matches
        setSelectedConversation(prev => {
          if (!prev) return prev;
          
          // Check if message belongs to current conversation (both real and temp)
          const isCurrentConversation = 
            prev.id === message.conversation_id || // Real conversation ID match
            (prev.other_user.id === message.receiver_id && message.sender_id === currentUser?.id) || // Sent from current user
            (prev.other_user.id === message.sender_id && message.receiver_id === currentUser?.id); // Received from other user
          
          if (isCurrentConversation) {
            setMessages(prevMsgs => {
              // Avoid duplicates by real ID
              if (prevMsgs.some(m => m.id === message.id)) {
                return prevMsgs;
              }
              // If I'm the sender and there's a matching temp message,
              // replace it with the real server message instead of adding a duplicate
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
              return [...prevMsgs, message];
            });
            
            // If this was a temp conversation, update it with real conversation ID
            if (prev.id.startsWith('temp-')) {
              return {
                ...prev,
                id: message.conversation_id,
              };
            }
          }
          return prev;
        });

        // Update unread count
        if (message.receiver_id === currentUser?.id) {
          setUnreadCount(prev => Math.max(0, prev + 1));
        }
      });

      // Listen for read receipts
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
  }, [socket, currentUser?.id, selectedConversation?.id, on]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setInitialError('');
      console.log('[Messaging] Loading conversations...');
      const convs = await api.getConversations();
      console.log('[Messaging] Conversations loaded:', convs);
      setConversations(convs || []);
      if (convs && convs.length > 0) {
        setSelectedConversation(convs[0]);
        await loadMessages(convs[0]);
      }
    } catch (err: any) {
      console.error('[Messaging] Failed to load conversations:', err);
      const errorMsg = err.message || 'Failed to load conversations';
      setInitialError(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversation: Conversation) => {
    try {
      console.log('[Messaging] Loading messages for:', conversation.other_user.id);
      const response = await api.getConversation(conversation.other_user.id, 50, 0);
      console.log('[Messaging] Messages loaded:', response);
      setMessages(response.messages || []);
    } catch (err: any) {
      console.error('[Messaging] Failed to load messages:', err);
      setError(err.message || 'Failed to load messages');
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await api.getUnreadMessageCount();
      setUnreadCount(response.unread_count || 0);
    } catch (err) {
      console.error('[Messaging] Failed to load unread count:', err);
      // Silently fail
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

    // Optimistically add message to UI
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
      const response = await api.sendMessage(
        selectedConversation.other_user.id,
        messageContent
      );
      console.log('[Messaging] Message sent:', response);
    } catch (err: any) {
      console.error('[Messaging] Failed to send message:', err);
      setError(err.message || 'Failed to send message');
      // Remove the optimistic message on error
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Messages</h1>
          <p className="text-stone-500 text-sm mt-1">Connect with your care team</p>
        </div>
        {unreadCount > 0 && (
          <div className="bg-red-100 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-sm font-semibold text-red-700">{unreadCount} unread</p>
          </div>
        )}
      </div>

      {/* Initial Error Alert */}
      {initialError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 text-sm">Error Loading Messages</h3>
            <p className="text-red-700 text-sm mt-1">{initialError}</p>
            <button
              onClick={() => loadConversations()}
              className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Conversations list */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-stone-100">
            <h2 className="font-semibold text-stone-800">Conversations</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3 animate-pulse">
                    <div className="h-4 bg-stone-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-stone-200 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <MessageCircle className="w-8 h-8 text-stone-300 mb-3" />
                <p className="text-sm text-stone-500">No conversations yet</p>
                <p className="text-xs text-stone-400 mt-1">Start by scheduling a session</p>
              </div>
            ) : (
              conversations.map(conversation => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={`w-full text-left p-3 border-b border-stone-100 hover:bg-stone-50 transition-colors ${
                    selectedConversation?.id === conversation.id ? 'bg-saffron-50 border-l-4 border-l-saffron-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-saffron-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-saffron-700">
                      {getInitials(conversation.other_user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">
                        {conversation.other_user.name}
                      </p>
                      {conversation.other_user.specialization && (
                        <p className="text-xs text-stone-400">{conversation.other_user.specialization}</p>
                      )}
                      <p className="text-xs text-stone-500 truncate mt-1">{conversation.last_message}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-stone-100 bg-gradient-to-r from-saffron-50 to-stone-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-saffron-100 flex items-center justify-center text-sm font-bold text-saffron-700">
                    {getInitials(selectedConversation.other_user.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-stone-800">
                      {selectedConversation.other_user.name}
                    </p>
                    {selectedConversation.other_user.specialization && (
                      <p className="text-xs text-stone-500">
                        {selectedConversation.other_user.specialization}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!messages || messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <MessageSquare className="w-8 h-8 text-stone-300 mb-3" />
                    <p className="text-sm text-stone-500">No messages yet</p>
                    <p className="text-xs text-stone-400 mt-1">Start the conversation</p>
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
                            ? 'bg-saffron-500 text-white rounded-br-none'
                            : 'bg-stone-100 text-stone-800 rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm break-words">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.sender_id === currentUser?.id
                              ? 'text-saffron-100'
                              : 'text-stone-500'
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

              {/* Error message */}
              {error && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {/* Message input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-stone-100 bg-stone-50">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Type a message…"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    disabled={sending}
                    className="flex-1 border border-stone-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={sending || !messageInput.trim()}
                    className="bg-saffron-500 hover:bg-saffron-600 text-white px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <MessageCircle className="w-12 h-12 text-stone-300 mb-4" />
              <p className="text-stone-600 font-medium">Select a conversation</p>
              <p className="text-stone-400 text-sm mt-1">Choose from your conversations to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
