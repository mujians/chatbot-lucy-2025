import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/ChatWidget';
import './styles/index.css';

// Mount the chat widget
ReactDOM.createRoot(document.getElementById('lucine-chat-root')).render(
  <React.StrictMode>
    <ChatWidget />
  </React.StrictMode>
);
