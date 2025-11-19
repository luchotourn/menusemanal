import { useEffect, useState } from "react";

interface StarAnimationsProps {
  starType: 'gold' | 'green' | 'blue';
  onComplete?: () => void;
}

export function StarAnimations({ starType, onComplete }: StarAnimationsProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; rotation: number }>>([]);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Skip animation if user prefers reduced motion
      if (onComplete) {
        setTimeout(onComplete, 100);
      }
      return;
    }

    // Generate random particles
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100 - 50, // -50 to 50
      y: Math.random() * -100 - 20, // -120 to -20
      rotation: Math.random() * 360,
    }));

    setParticles(newParticles);

    // Clean up after animation completes
    const timer = setTimeout(() => {
      setParticles([]);
      if (onComplete) {
        onComplete();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [starType, onComplete]);

  // Color based on star type
  const colors = {
    gold: 'bg-yellow-400',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
  };

  const shadowColors = {
    gold: 'shadow-yellow-300',
    green: 'shadow-green-300',
    blue: 'shadow-blue-300',
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`
            absolute w-3 h-3 rounded-full
            ${colors[starType]}
            ${shadowColors[starType]}
            shadow-lg
            animate-[particle_1s_ease-out_forwards]
          `}
          style={{
            transform: `translate(${particle.x}%, ${particle.y}%) rotate(${particle.rotation}deg)`,
            opacity: 0,
          }}
        />
      ))}

      {/* Center star burst */}
      <div className="relative">
        <div className={`
          w-16 h-16 rounded-full
          ${colors[starType]}
          ${shadowColors[starType]}
          shadow-2xl
          animate-[burst_0.6s_ease-out_forwards]
          flex items-center justify-center text-3xl
        `}>
          {starType === 'gold' && '⭐'}
          {starType === 'green' && '💚'}
          {starType === 'blue' && '💬'}
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes particle {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(0);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx, 0), var(--ty, -100px)) rotate(360deg) scale(1);
            opacity: 0;
          }
        }

        @keyframes burst {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.3) rotate(180deg);
            opacity: 1;
          }
          100% {
            transform: scale(0.8) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// Confetti component for first star of the day or special achievements
export function ConfettiAnimation({ onComplete }: { onComplete?: () => void }) {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      if (onComplete) {
        setTimeout(onComplete, 100);
      }
      return;
    }

    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    color: ['bg-yellow-400', 'bg-green-500', 'bg-blue-500', 'bg-pink-500', 'bg-purple-500'][i % 5],
    delay: Math.random() * 0.5,
    x: Math.random() * 100,
    duration: 1.5 + Math.random() * 1,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className={`
            absolute w-2 h-2 rounded-sm
            ${piece.color}
            animate-[confetti_${piece.duration}s_ease-out_forwards]
          `}
          style={{
            left: `${piece.x}%`,
            top: '-10px',
            animationDelay: `${piece.delay}s`,
          }}
        />
      ))}

      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
