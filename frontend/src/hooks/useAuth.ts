import { useState, useCallback, useEffect } from 'react';
import { User } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('turjuman_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('turjuman_user');
      }
    }
    setIsLoading(false);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Simulate Google OAuth flow
      // In a real app, this would integrate with Google OAuth
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockUser: User = {
        id: 'user_' + Date.now(),
        name: 'أحمد محمد',
        email: 'ahmed@example.com',
        avatar: `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face`,
        createdAt: new Date()
      };
      
      setUser(mockUser);
      localStorage.setItem('turjuman_user', JSON.stringify(mockUser));
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('turjuman_user');
  }, []);

  return {
    user,
    isLoading,
    signInWithGoogle,
    signOut
  };
};