import React, { useState } from 'react';

interface KidButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
  showRipple?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function KidButton({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  className = '',
  showRipple = true,
  type = 'button'
}: KidButtonProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const variantClasses = {
    primary: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-300',
    secondary: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-300',
    success: 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-300',
    warning: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-300'
  };

  const sizeClasses = {
    small: 'px-4 py-2 text-sm',
    medium: 'px-6 py-3 text-base',
    large: 'px-8 py-4 text-lg'
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (showRipple) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newRipple = { id: Date.now(), x, y };

      setRipples(prev => [...prev, newRipple]);
      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
      }, 600);
    }

    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      type={type}
      className={`
        kid-button relative overflow-hidden
        rounded-2xl font-semibold
        transition-all duration-300 ease-out
        transform hover:scale-105 hover:-translate-y-1
        active:scale-95 active:translate-y-0
        focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-opacity-50
        shadow-lg hover:shadow-xl
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled
          ? 'opacity-50 cursor-not-allowed transform-none hover:transform-none'
          : 'cursor-pointer'
        }
        ${className}
      `}
      onClick={handleClick}
      disabled={disabled}
    >
      <span className="relative z-10">{children}</span>

      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute bg-white bg-opacity-30 rounded-full animate-ping"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
            animationDuration: '0.6s'
          }}
        />
      ))}
    </button>
  );
}