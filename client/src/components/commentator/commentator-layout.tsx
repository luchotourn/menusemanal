import React from 'react';
import { useAuthStatus } from '@/hooks/useAuth';
import { StarRating } from './star-rating';
import { EmojiReactions } from './emoji-reactions';
import { KidButton } from './kid-button';
import { ProgressTracker } from './progress-tracker';

interface CommentatorLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function CommentatorLayout({ children, className = '' }: CommentatorLayoutProps) {
  const { data: authStatus } = useAuthStatus();
  const user = authStatus?.user;

  if (!user || user.role !== 'commentator') {
    return <div className="text-center p-8">Solo para niños 👶</div>;
  }

  return (
    <div className={`commentator-theme min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 ${className}`}>
      {/* Fun Header */}
      <header className="bg-white shadow-lg rounded-b-3xl mx-4 mb-6">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                👨‍🍳
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  ¡Hola, {user.email.split('@')[0]}! 👋
                </h1>
                <p className="text-purple-600 font-medium">¡Hora de calificar comidas!</p>
              </div>
            </div>

            {/* Fun Stats */}
            <div className="hidden md:flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">12</div>
                <div className="text-xs text-gray-600">Comidas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">★★★★☆</div>
                <div className="text-xs text-gray-600">Promedio</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pb-24">
        {children}
      </main>

      {/* Fun Footer with Achievements Teaser */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-purple-200 rounded-t-3xl shadow-2xl">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <span className="font-medium text-gray-700">¡Sigue calificando para ganar insignias!</span>
            </div>
            <ProgressTracker
              current={3}
              total={5}
              label=""
              size="small"
              variant="rainbow"
              className="w-32"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

// Celebration component for achievements
export function CelebrationToast({ emoji, message, onComplete }: {
  emoji: string;
  message: string;
  onComplete: () => void;
}) {
  React.useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="celebration fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="bg-white rounded-3xl p-8 shadow-2xl border-4 border-purple-300 animate-bounce">
        <div className="text-6xl text-center mb-4">{emoji}</div>
        <div className="text-xl font-bold text-purple-600 text-center">{message}</div>
      </div>
    </div>
  );
}

// Demo component to showcase the design system
export function CommentatorDemo() {
  const [rating, setRating] = React.useState(0);
  const [reaction, setReaction] = React.useState('');
  const [showCelebration, setShowCelebration] = React.useState(false);

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    if (newRating >= 4) {
      setShowCelebration(true);
    }
  };

  return (
    <CommentatorLayout>
      <div className="space-y-8">
        {/* Recipe Card Example */}
        <div className="kid-card bg-white rounded-3xl p-6 shadow-xl border-4 border-purple-100 hover:border-purple-300 transition-all duration-300">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">🍝 Pasta con Salsa</h2>
            <p className="text-lg text-gray-600">¿Qué te pareció esta comida?</p>
          </div>

          <div className="space-y-6">
            {/* Star Rating */}
            <div className="text-center">
              <label className="block text-lg font-semibold text-gray-700 mb-3">
                ⭐ Califica del 1 al 5
              </label>
              <StarRating
                value={rating}
                onChange={handleRatingChange}
                size="large"
              />
            </div>

            {/* Emoji Reactions */}
            <div className="text-center">
              <label className="block text-lg font-semibold text-gray-700 mb-3">
                😊 ¿Cómo te sentiste?
              </label>
              <EmojiReactions
                value={reaction}
                onChange={setReaction}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <KidButton
                variant="success"
                onClick={() => setShowCelebration(true)}
                className="text-lg"
              >
                ¡Guardar! 🎉
              </KidButton>
              <KidButton
                variant="secondary"
                onClick={() => {
                  setRating(0);
                  setReaction('');
                }}
              >
                Borrar 🗑️
              </KidButton>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="kid-card bg-white rounded-3xl p-6">
          <h3 className="text-2xl font-bold text-center text-gray-800 mb-4">
            🏆 Tu Progreso
          </h3>
          <div className="space-y-4">
            <ProgressTracker
              current={7}
              total={10}
              label="Comidas calificadas esta semana"
              variant="rainbow"
              size="large"
            />
            <ProgressTracker
              current={3}
              total={5}
              label="Próxima insignia: Crítico Culinario"
              variant="default"
              size="medium"
            />
          </div>
        </div>
      </div>

      {/* Celebration */}
      {showCelebration && (
        <CelebrationToast
          emoji="🎉"
          message="¡Excelente calificación!"
          onComplete={() => setShowCelebration(false)}
        />
      )}
    </CommentatorLayout>
  );
}