import React from 'react';

/**
 * StatusBadge - Semantic status indicator with muted background
 * @param {'good'|'fair'|'poor'|'critical'} status - The semantic status
 * @param {React.ReactNode} [children] - Optional override for display text
 * @param {string} [className] - Additional CSS classes
 */
const StatusBadge = ({ status, children, className = '' }) => {
  const statusStyles = {
    good: 'bg-co2-good-bg text-co2-good',
    fair: 'bg-co2-fair-bg text-co2-fair',
    poor: 'bg-co2-poor-bg text-co2-poor',
    critical: 'bg-co2-critical-bg text-co2-critical',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusStyles[status] || 'bg-stone-100 text-stone-500'} ${className}`}
    >
      {children || status}
    </span>
  );
};

export default StatusBadge;
