import { useState, useEffect, useRef } from 'react';
import './App.css'; 

// --- INTERFACES ---
interface Chunk {
  text: string;
  score: number;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  chunks?: Chunk[];
}

interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  documentName?: string;
  uploadStatus?: string;
}

function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const startNewChat = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/session');
      const data = await res.json();
      
      const newSession: ChatSession = {
        id: data.sessionId,
        name: `Chat ${sessions.length + 1}`,
        messages: [{ 
            role: 'assistant', 
            text: 'Hi! 👋 Upload one or more documents from the left, then ask me anything about them here.' 
        }],
        uploadStatus: ''
      };

      setSessions(prev => [newSession, ...prev]);
      setActiveId(data.sessionId);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  useEffect(() => {
    if (sessions.length === 0) startNewChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeId]);

  const activeSession = sessions.find(s => s.id === activeId);

  const deleteSession = async (id: string) => {
    try {
      await fetch('http://localhost:3001/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
      });
      const updated = sessions.filter(s => s.id !== id);
      setSessions(updated);
      if (activeId === id) setActiveId(updated[0]?.id || '');
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleFileUpload = async () => {
    if (!file || !activeId) return;

    updateSession(activeId, { uploadStatus: 'Processing document...' });
    
    const formData = new FormData();
    formData.append('document', file);
    formData.append('sessionId', activeId);

    try {
      const res = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (res.ok) {
        updateSession(activeId, { 
          uploadStatus: `Success! ${data.chunks} chunks created.`,
          documentName: file.name 
        });
      } else {
        updateSession(activeId, { uploadStatus: `Error: ${data.error}` });
      }
    } catch (error) {
      updateSession(activeId, { uploadStatus: 'Upload failed.' });
    }
  };

  const handleAskQuestion = async () => {
    if (!input.trim() || !activeId || isLoading) return;

    const userMsgText = input;
    setInput('');
    
    addMessageToSession(activeId, { role: 'user', text: userMsgText });
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:3001/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeId, question: userMsgText }),
      });
      const data = await res.json();

      if (res.ok) {
        addMessageToSession(activeId, { 
          role: 'assistant', 
          text: data.answer, 
          chunks: data.retrievedChunks || data.chunks 
        });
      } else {
        addMessageToSession(activeId, { role: 'assistant', text: `Error: ${data.error}` });
      }
    } catch (error) {
      addMessageToSession(activeId, { role: 'assistant', text: 'Server error.' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSession = (id: string, updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addMessageToSession = (id: string, msg: Message) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, messages: [...s.messages, msg] } : s));
  };

  return (
    <div className="app-body">
      <div className="top-border"></div>
      
      <nav className="navbar">
        <div className="logo"><br/>SessionRag</div>
        <ul className="nav-links">
          <li><a href="/">Home</a></li>
          <li><a href="/#about">About</a></li>
          <li><a href="/chatbot">Chatbot</a></li>
        </ul>
      </nav>

      <div className="app-wrapper">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo-circle">Bot</div>
            <div>
              <div className="sidebar-title">ChatWithPDF</div>
              <div className="sidebar-subtitle">Ask anything!</div>
            </div>
          </div>

          <div className="sidebar-section">
            <label className="sidebar-label" htmlFor="docUpload">Upload documents</label>
            <p className="sidebar-helper">PDF, DOCX, TXT</p>
            <input 
              type="file" 
              className="sidebar-file-input" 
              id="docUpload" 
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
            />
            <button onClick={handleFileUpload} className="sidebar-btn btn-success">
              Upload document
            </button>
            <p className="sidebar-status">{activeSession?.uploadStatus}</p>
          </div>

          <div className="sidebar-section" style={{marginTop: '0'}}>
            <button onClick={startNewChat} className="sidebar-btn btn-primary">
              + New Chat
            </button>
          </div>

          <div className="sidebar-history">
            <label className="sidebar-label">Recent Chats</label>
            {sessions.map(s => (
              <div key={s.id} className={`history-item ${activeId === s.id ? 'active' : ''}`}>
                <div onClick={() => setActiveId(s.id)} style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  💬 {s.name}
                </div>
                <button className="delete-session-btn" onClick={() => deleteSession(s.id)}>🗑️</button>
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <small>Session: {activeId.substring(0, 8)}...</small>
          </div>
        </aside>

        <main className="chat-main">
          <header className="chat-main-header">
            <div>
              <h1>Start chatting with your PDF!</h1>
              <p>Upload files on the left and start asking questions here.</p>
            </div>
          </header>

          <section className="chat-main-body">
            <div className="chat-box">
              <div className="chat-header">
                <div>
                  <h4 className="chat-title">ChatBot</h4>
                  <small className="chat-subtitle">Assistant for your uploaded documents</small>
                </div>
              </div>

              <div className="chat-messages">
                {activeSession?.messages.map((msg, index) => (
                  <div key={index} className={`message-row ${msg.role}`}>
                    <div className={`avatar ${msg.role}-avatar`}>
                      {msg.role === 'assistant' ? 'AI' : 'U'}
                    </div>
                    <div className={`message-bubble ${msg.role}-bubble`}>
                      <div className="message-label">{msg.role === 'assistant' ? 'Assistant' : 'You'}</div>
                      <div className="message-text">{msg.text}</div>
                      
                      {msg.chunks && msg.chunks.length > 0 && (
                        <details className="source-accordion">
                          <summary>View Sources</summary>
                          <div className="source-content">
                            {msg.chunks.map((chunk, i) => (
                              <div key={i} className="chunk-item">
                                <div>"{chunk.text.substring(0, 100)}..."</div>
                                <strong>Score: {chunk.score.toFixed(3)}</strong>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && <div className="message-row assistant"><div className="avatar assistant-avatar">AI</div><div className="message-bubble assistant-bubble">Thinking...</div></div>}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <div className="chat-input-inner">
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Send a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                  />
                  <button onClick={handleAskQuestion} className="chat-send-btn">➤</button>
                </div>
                <p className="chat-hint">I’ll answer only using the content of your uploaded documents.</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;