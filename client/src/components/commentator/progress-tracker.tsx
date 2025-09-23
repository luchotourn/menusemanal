import React from 'react';

interface ProgressTrackerProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'rainbow';
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}

export function ProgressTracker({
  current,
  total,
  label,
  showPercentage = true,
  variant = 'default',
  size = 'medium',
  animated = true
}: ProgressTrackerProps) {
  const percentage = Math.min((current / total) * 100, 100);

  const sizeClasses = {
    small: 'h-4',
    medium: 'h-6',
    large: 'h-8'
  };

  const gradientClasses = {
    default: 'bg-gradient-to-r from-purple-500 to-blue-500',
    rainbow: 'bg-gradient-to-r from-purple-500 via-blue-500 via-green-500 to-yellow-500'
  };

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm font-bold text-purple-600">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div
        className={`
          progress-bar w-full bg-gray-200 rounded-full overflow-hidden
          ${sizeClasses[size]}
        `}
      >
        <div
          className={`
            progress-bar-fill h-full rounded-full transition-all duration-1000 ease-out
            flex items-center justify-end pr-2 text-white text-xs font-semibold
            relative
            ${gradientClasses[variant]}
          `}
          style={{ width: `${percentage}%` }}
        >
          {/* Shimmer effect */}
          {animated && percentage > 0 && (
            <div
              className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white via-transparent opacity-30"
              style={{
                animation: 'shimmer 2s infinite',
                backgroundSize: '200% 100%'
              }}
            />
          )}

          {/* Progress text inside bar (only if there's enough space) */}
          {percentage > 25 && showPercentage && size !== 'small' && (
            <span className="relative z-10">
              {current}/{total}
            </span>
          )}
        </div>
      </div>

      {/* Achievement milestones */}
      {total <= 10 && (
        <div className="flex justify-between mt-1">
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={`
                w-2 h-2 rounded-full transition-colors duration-300
                ${i < current ? 'bg-purple-500' : 'bg-gray-300'}
              `}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// CSS for shimmer animation (add to global styles)
const shimmerKeyframes = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`;