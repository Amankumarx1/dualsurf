import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { setupBrowserBridge } from './mockBrowserBridge';

// Initialize standalone browser bridge if running in Microsoft Edge / standard web browser
setupBrowserBridge();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
