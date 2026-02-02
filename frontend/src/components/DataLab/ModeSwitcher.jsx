import React from 'react';
import { colors } from '../../design/tokens';

/**
 * ModeSwitcher Component
 * 
 * Toggles between 'analysis' and 'export' modes in DataLab.
 * Features glassmorphism styling with smooth transitions.
 */
const ModeSwitcher = ({ mode, setMode }) => {
  const buttonBaseStyle = {
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: "'Inter', sans-serif",
    transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
  };

  const getButtonStyle = (isActive) => ({
    ...buttonBaseStyle,
    background: 'transparent',
    color: isActive ? '#FFFFFF' : '#71717a', // White for active, Zinc-500 for inactive
    border: isActive ? '1px solid #FFFFFF' : '1px solid transparent',
    boxShadow: 'none',
    transform: 'translateY(0)',
  });

  return (
    <div
      className="flex gap-4 p-0"
    >
      <button
        style={getButtonStyle(mode === 'analysis')}
        onClick={() => setMode('analysis')}
        onMouseEnter={(e) => {
          if (mode !== 'analysis') {
            e.currentTarget.style.color = '#a1a1aa'; // Zinc-400
          }
        }}
        onMouseLeave={(e) => {
          if (mode !== 'analysis') {
            e.currentTarget.style.color = '#71717a';
          }
        }}
      >
        Analyse
      </button>

      <button
        style={getButtonStyle(mode === 'export')}
        onClick={() => setMode('export')}
        onMouseEnter={(e) => {
          if (mode !== 'export') {
            e.currentTarget.style.color = '#a1a1aa';
          }
        }}
        onMouseLeave={(e) => {
          if (mode !== 'export') {
            e.currentTarget.style.color = '#71717a';
          }
        }}
      >
        Export Data
      </button>
    </div>
  );
};

export default ModeSwitcher;
