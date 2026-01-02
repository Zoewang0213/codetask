import React, { useState } from 'react';
import './App.css';
import CitationNetwork from './components/CitationNetwork';
import CollaborationNetwork from './components/CollaborationNetwork';
import Timeline from './components/Timeline';
import PatentHistogram from './components/PatentHistogram';
import NetworkOptimized from './components/NetworkOptimized';

type TabType = 'networks' | 'timeline' | 'optimized';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('networks');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  return (
    <div className="App">
      <header className="App-header">
        <h1>SciSciNet UMD Visualization</h1>
        <p>University of Maryland Computer Science Research Analytics</p>
      </header>

      <nav className="App-nav">
        <button
          className={activeTab === 'networks' ? 'active' : ''}
          onClick={() => setActiveTab('networks')}
        >
          T1: Citation & Collaboration Networks
        </button>
        <button
          className={activeTab === 'timeline' ? 'active' : ''}
          onClick={() => setActiveTab('timeline')}
        >
          T2: Timeline & Patents
        </button>
        <button
          className={activeTab === 'optimized' ? 'active' : ''}
          onClick={() => setActiveTab('optimized')}
        >
          T3: Optimized Network
        </button>
      </nav>

      <main className="App-main">
        {activeTab === 'networks' && (
          <div className="networks-container">
            <div className="network-panel">
              <CitationNetwork width={700} height={500} />
            </div>
            <div className="network-panel">
              <CollaborationNetwork width={700} height={500} />
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="timeline-container">
            <Timeline
              width={1000}
              height={350}
              selectedYear={selectedYear}
              onYearSelect={setSelectedYear}
            />
            <PatentHistogram
              width={1000}
              height={300}
              selectedYear={selectedYear}
            />
          </div>
        )}

        {activeTab === 'optimized' && (
          <div className="optimized-container">
            <NetworkOptimized width={900} height={900} networkType="collaboration" />
          </div>
        )}
      </main>

      <footer className="App-footer">
        <p>Data Source: SciSciNet v2 (Northwestern University)</p>
        <p>Filtered for UMD Computer Science Papers (2014-2024)</p>
      </footer>
    </div>
  );
}

export default App;
