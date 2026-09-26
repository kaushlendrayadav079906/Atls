import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'medium', message }) => {
  const sizeMap = {
    small: '18px',
    medium: '32px',
    large: '48px',
  };

  return (
    <div className="spinner-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px' }}>
      <div
        className="spinner-element"
        style={{
          width: sizeMap[size],
          height: sizeMap[size],
          border: '3px solid rgba(59, 130, 246, 0.2)',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {message && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{message}</span>}
    </div>
  );
};
