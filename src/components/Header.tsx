import type { CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext';

export function Header() {
  const { userEmail, signOut } = useAuth();

  return (
    <header style={headerStyle}>
      <span style={titleStyle}>Gmail Cleaner</span>
      <div style={rightStyle}>
        {userEmail && <span style={emailStyle}>{userEmail}</span>}
        <button onClick={signOut} style={signOutBtnStyle}>
          Sign out
        </button>
      </div>
    </header>
  );
}

const headerStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 1.25rem',
  height: '52px',
  background: '#1a73e8',
  color: '#fff',
  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '1.1rem',
  letterSpacing: '0.01em',
};

const rightStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const emailStyle: CSSProperties = {
  fontSize: '0.875rem',
  opacity: 0.9,
};

const signOutBtnStyle: CSSProperties = {
  padding: '0.3rem 0.75rem',
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.4)',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.875rem',
};
