import React, { useState } from 'react';

interface EmojiReaction {
  emoji: string;
  label: string;
  value: string;
}

interface EmojiReactionsProps {
  value?: string;
  onChange?: (reaction: string) => void;
  disabled?: boolean;
}

const reactions: EmojiReaction[] = [
  { emoji: '😍', label: 'Me encanta', value: 'love' },
  { emoji: '😊', label: 'Me gusta', value: 'like' },
  { emoji: '😐', label: 'Está bien', value: 'okay' },
  { emoji: '😕', label: 'No me gusta', value: 'dislike' },
  { emoji: '🤢', label: 'No me gusta nada', value: 'hate' }
];

export function EmojiReactions({ value, onChange, disabled = false }: EmojiReactionsProps) {
  const [animatingEmoji, setAnimatingEmoji] = useState<string | null>(null);

  const handleReactionClick = (reactionValue: string) => {
    if (!disabled && onChange) {
      onChange(reactionValue);
      setAnimatingEmoji(reactionValue);
      setTimeout(() => setAnimatingEmoji(null), 500);
    }
  };

  return (
    <div className="flex gap-3 justify-center flex-wrap">
      {reactions.map((reaction) => (
        <button
          key={reaction.value}
          type="button"
          className={`
            emoji-reaction w-12 h-12 md:w-16 md:h-16 rounded-full
            flex items-center justify-center text-2xl md:text-3xl
            transition-all duration-200 border-2
            ${value === reaction.value
              ? 'selected bg-gradient-to-br from-purple-500 to-blue-500 border-purple-500 text-white scale-110'
              : 'bg-purple-50 border-transparent hover:border-purple-300 hover:bg-purple-100'
            }
            ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'}
            ${animatingEmoji === reaction.value ? 'animate-pulse' : ''}
          `}
          onClick={() => handleReactionClick(reaction.value)}
          disabled={disabled}
          title={reaction.label}
        >
          <span className={`${animatingEmoji === reaction.value ? 'animate-bounce' : ''}`}>
            {reaction.emoji}
          </span>
        </button>
      ))}
    </div>
  );
}