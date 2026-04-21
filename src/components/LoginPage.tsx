import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';

export function LoginPage() {
  const { error, signIn } = useAuth();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '24px',
        fontFamily: 'sans-serif',
      }}
    >
      <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 600 }}>Gmail Cleaner</h1>
      <p style={{ margin: 0, color: '#5f6368', fontSize: '1rem' }}>
        Analyze and clean your Gmail inbox
      </p>

      <GoogleSignInButton />

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            backgroundColor: '#fce8e6',
            color: '#c5221f',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          <span>Authorization failed. Please try again.</span>
          <button
            onClick={() => signIn()}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              color: '#c5221f',
              backgroundColor: 'transparent',
              border: '1px solid #c5221f',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
