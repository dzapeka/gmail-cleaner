import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function GoogleSignInButton() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await signIn();
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: 500,
        color: '#3c4043',
        backgroundColor: '#fff',
        border: '1px solid #dadce0',
        borderRadius: '4px',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'background-color 0.2s',
      }}
    >
      {loading ? 'Signing in…' : 'Sign in with Google'}
    </button>
  );
}
