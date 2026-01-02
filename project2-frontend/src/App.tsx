import React from 'react';
import './App.css';
import ChatInterface from './components/ChatInterface';

function App() {
  return (
    <div className="App">
      <ChatInterface apiUrl="http://localhost:5001" />
    </div>
  );
}

export default App;
