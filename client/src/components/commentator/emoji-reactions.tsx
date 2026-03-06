export interface EmojiReaction {
  emoji: string;
  label: string;
  value: string;
}

// Kept for backward compatibility: historical comments store emoji keys like 'love', 'like', etc.
// This array maps those keys to display characters in comment lists.
export const reactions: EmojiReaction[] = [
  { emoji: '😍', label: 'Me encanta', value: 'love' },
  { emoji: '😊', label: 'Me gusta', value: 'like' },
  { emoji: '😐', label: 'Está bien', value: 'okay' },
  { emoji: '😕', label: 'No me gusta', value: 'dislike' },
  { emoji: '🤢', label: 'No me gusta nada', value: 'hate' }
];
