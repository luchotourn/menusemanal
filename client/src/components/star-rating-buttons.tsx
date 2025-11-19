import { Button } from "@/components/ui/button";
import { useMealAchievements } from "@/hooks/use-meal-achievements";
import type { MealAchievement } from "@shared/schema";
import { Star, Leaf, MessageCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface StarRatingButtonsProps {
  mealPlanId: number;
  achievements?: MealAchievement;
  onStarEarned?: (starType: string) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

export function StarRatingButtons({
  mealPlanId,
  achievements,
  onStarEarned,
  size = 'md',
  disabled = false,
  className = '',
}: StarRatingButtonsProps) {
  const { awardStar, isAwarding, mealAchievements } = useMealAchievements(mealPlanId);
  const [animatingStars, setAnimatingStars] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Use either prop achievements or fetched achievements
  const currentAchievements = achievements || mealAchievements[0];

  // Check if star is already earned
  const hasTriedIt = currentAchievements?.triedIt === 1;
  const hasAteVeggie = currentAchievements?.ateVeggie === 1;
  const hasLeftFeedback = currentAchievements?.leftFeedback === 1;

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  const handleAwardStar = async (starType: 'tried_it' | 'ate_veggie') => {
    // Trigger haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    // Add animation
    setAnimatingStars(prev => new Set(prev).add(starType));

    // Award the star
    awardStar({ mealPlanId, starType });

    // Call callback if provided
    if (onStarEarned) {
      onStarEarned(starType);
    }

    // Clear existing timeout for this star type if any
    const existingTimeout = timeoutsRef.current.get(starType);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Remove animation after 600ms
    const timeoutId = setTimeout(() => {
      setAnimatingStars(prev => {
        const newSet = new Set(prev);
        newSet.delete(starType);
        return newSet;
      });
      timeoutsRef.current.delete(starType);
    }, 600);

    // Store timeout reference
    timeoutsRef.current.set(starType, timeoutId);
  };

  // Size configurations
  const sizeClasses = {
    sm: 'h-10 text-xs px-3',
    md: 'h-12 text-sm px-4',
    lg: 'h-14 text-base px-6',
  };

  const iconSize = {
    sm: 16,
    md: 18,
    lg: 20,
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-gray-700 mb-3">Gana estrellas</h3>

      {/* Gold Star: I Tried It */}
      <Button
        onClick={() => handleAwardStar('tried_it')}
        disabled={disabled || isAwarding || hasTriedIt}
        className={`
          w-full ${sizeClasses[size]}
          ${hasTriedIt
            ? 'bg-yellow-500 hover:bg-yellow-500 text-white cursor-default'
            : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-2 border-yellow-300'
          }
          ${animatingStars.has('tried_it') ? 'animate-pulse scale-105' : ''}
          transition-all duration-300 font-semibold shadow-sm
        `}
        aria-label="I tried it gold star"
        aria-pressed={hasTriedIt}
      >
        <Star
          className={`mr-2 ${hasTriedIt ? 'fill-current' : ''}`}
          size={iconSize[size]}
        />
        <span>{hasTriedIt ? '¡Lo probé! ✓' : '¡Lo probé!'}</span>
      </Button>

      {/* Green Star: Ate Veggie */}
      <Button
        onClick={() => handleAwardStar('ate_veggie')}
        disabled={disabled || isAwarding || hasAteVeggie}
        className={`
          w-full ${sizeClasses[size]}
          ${hasAteVeggie
            ? 'bg-green-600 hover:bg-green-600 text-white cursor-default'
            : 'bg-green-100 hover:bg-green-200 text-green-800 border-2 border-green-300'
          }
          ${animatingStars.has('ate_veggie') ? 'animate-pulse scale-105' : ''}
          transition-all duration-300 font-semibold shadow-sm
        `}
        aria-label="Ate veggie green star"
        aria-pressed={hasAteVeggie}
      >
        <Leaf
          className={`mr-2 ${hasAteVeggie ? 'fill-current' : ''}`}
          size={iconSize[size]}
        />
        <span>{hasAteVeggie ? '¡Comí vegetales! ✓' : '¡Comí vegetales!'}</span>
      </Button>

      {/* Blue Star: Left Feedback - Read-only indicator (earned via commenting) */}
      <div
        className={`
          w-full ${sizeClasses[size]}
          ${hasLeftFeedback
            ? 'bg-blue-600 text-white'
            : 'bg-blue-50 text-blue-700 border-2 border-dashed border-blue-300'
          }
          rounded-lg flex items-center justify-center font-semibold shadow-sm
          transition-all duration-300
        `}
        aria-label="Left feedback blue star"
        role="status"
      >
        <MessageCircle
          className={`mr-2 ${hasLeftFeedback ? 'fill-current' : ''}`}
          size={iconSize[size]}
        />
        <span className="text-xs">
          {hasLeftFeedback
            ? '¡Dejé mi opinión! ✓'
            : 'Deja un comentario para ganar esta estrella'}
        </span>
      </div>

      {/* Progress indicator */}
      {(hasTriedIt || hasAteVeggie || hasLeftFeedback) && (
        <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
          <p className="text-sm text-center text-gray-700 font-medium">
            🎉 {[hasTriedIt, hasAteVeggie, hasLeftFeedback].filter(Boolean).length} de 3 estrellas ganadas
          </p>
        </div>
      )}
    </div>
  );
}
