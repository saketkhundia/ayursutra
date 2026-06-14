import React from 'react';
import ReactDOM from 'react-dom/client';
import { AyurThemeProvider } from './context/AyurThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AyurThemeProvider>
        <App />
      </AyurThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
