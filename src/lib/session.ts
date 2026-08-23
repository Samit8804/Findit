export interface SessionUser {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
}

// Mock session — replace with real auth (NextAuth / custom) when backend lands.
export function getCurrentSession(): { user: SessionUser } {
  return {
    user: {
      id: 'user-demo-001',
      name: 'Demo User',
      email: 'demo.user@findit.example',
      joinedAt: 'Jan 2026',
    },
  };
}