import React, { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'small' | 'medium' | 'large';
  showAnimation?: boolean;
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'medium',
  showAnimation = true
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const sizeClasses = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-5xl'
  };

  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating);
      if (showAnimation) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      }
    }
  };

  const handleMouseEnter = (rating: number) => {
    if (!readonly) {
      setHoverValue(rating);
    }
  };

  const handleMouseLeave = () => {
    setHoverValue(null);
  };

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className="star-rating flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${sizeClasses[size]} transition-all duration-200 ${
            star <= displayValue ? 'filled text-yellow-400' : 'text-gray-300'
          } ${!readonly ? 'hover:scale-125 cursor-pointer' : 'cursor-default'} ${
            isAnimating && star === value ? 'animate-bounce' : ''
          }`}
          onClick={() => handleClick(star)}
          onMouseEnter={() => handleMouseEnter(star)}
          onMouseLeave={handleMouseLeave}
          disabled={readonly}
        >
          {star <= displayValue ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}