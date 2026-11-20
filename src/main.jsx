import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { IconContext } from '@phosphor-icons/react';
import './styles.css';
import './magic-effects.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: 'regular', 'aria-hidden': true }}>
      <App />
    </IconContext.Provider>
  </React.StrictMode>,
);
