import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './assets/styles/reset.css';
import './assets/styles/tokens.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Barycenter root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
