export interface Word {
  word: string;
  hint: string; // used as DALL-E prompt context
  emoji: string; // fallback while image loads
}

export interface AgeGroup {
  label: string;
  minAge: number;
  maxAge: number;
  words: Word[];
}

export const AGE_GROUPS: AgeGroup[] = [
  {
    label: "Tiny Tots",
    minAge: 3,
    maxAge: 5,
    words: [
      { word: "bee", hint: "a yellow and black striped bee", emoji: "🐝" },
      { word: "cat", hint: "a cute cartoon cat", emoji: "🐱" },
      { word: "dog", hint: "a friendly cartoon dog", emoji: "🐶" },
      { word: "sun", hint: "a bright yellow sun with rays", emoji: "☀️" },
      { word: "hat", hint: "a colorful birthday hat", emoji: "🎩" },
      { word: "pig", hint: "a pink cartoon pig", emoji: "🐷" },
      { word: "egg", hint: "a white egg", emoji: "🥚" },
      { word: "cup", hint: "a cute colorful cup", emoji: "🥤" },
      { word: "bus", hint: "a bright yellow school bus", emoji: "🚌" },
      { word: "cow", hint: "a friendly black and white cow", emoji: "🐄" },
    ],
  },
  {
    label: "Little Learners",
    minAge: 6,
    maxAge: 7,
    words: [
      { word: "frog", hint: "a green cartoon frog on a lily pad", emoji: "🐸" },
      { word: "tree", hint: "a big green tree", emoji: "🌳" },
      { word: "cake", hint: "a colorful birthday cake", emoji: "🎂" },
      { word: "bird", hint: "a small colorful bird on a branch", emoji: "🐦" },
      { word: "fish", hint: "a bright orange fish in water", emoji: "🐟" },
      { word: "bear", hint: "a friendly cartoon bear", emoji: "🐻" },
      { word: "duck", hint: "a yellow cartoon duck", emoji: "🦆" },
      { word: "rain", hint: "raindrops falling from a cloud", emoji: "🌧️" },
      { word: "moon", hint: "a glowing crescent moon with stars", emoji: "🌙" },
      { word: "star", hint: "a bright yellow star", emoji: "⭐" },
      { word: "kite", hint: "a colorful kite flying in the sky", emoji: "🪁" },
      { word: "boat", hint: "a small colorful sailboat on water", emoji: "⛵" },
    ],
  },
  {
    label: "Super Spellers",
    minAge: 8,
    maxAge: 9,
    words: [
      { word: "apple", hint: "a shiny red apple", emoji: "🍎" },
      { word: "cloud", hint: "a fluffy white cloud in a blue sky", emoji: "☁️" },
      { word: "tiger", hint: "a cartoon orange tiger", emoji: "🐯" },
      { word: "horse", hint: "a brown cartoon horse", emoji: "🐴" },
      { word: "pizza", hint: "a delicious pizza slice", emoji: "🍕" },
      { word: "grape", hint: "a bunch of purple grapes", emoji: "🍇" },
      { word: "beach", hint: "a sunny beach with waves", emoji: "🏖️" },
      { word: "bread", hint: "a loaf of golden bread", emoji: "🍞" },
      { word: "piano", hint: "a black and white piano", emoji: "🎹" },
      { word: "globe", hint: "a colorful globe of the earth", emoji: "🌍" },
    ],
  },
  {
    label: "Word Champions",
    minAge: 10,
    maxAge: 99,
    words: [
      { word: "flower", hint: "a bright colorful flower", emoji: "🌸" },
      { word: "castle", hint: "a fairytale castle", emoji: "🏰" },
      { word: "rabbit", hint: "a white fluffy rabbit", emoji: "🐰" },
      { word: "bridge", hint: "a stone bridge over a river", emoji: "🌉" },
      { word: "candle", hint: "a glowing candle with a flame", emoji: "🕯️" },
      { word: "spider", hint: "a cartoon spider on a web", emoji: "🕷️" },
      { word: "parrot", hint: "a colorful cartoon parrot", emoji: "🦜" },
      { word: "rocket", hint: "a cartoon rocket launching into space", emoji: "🚀" },
      { word: "cactus", hint: "a cartoon green cactus", emoji: "🌵" },
      { word: "donkey", hint: "a cartoon donkey", emoji: "🫏" },
    ],
  },
];

export function getAgeGroup(age: number): AgeGroup {
  return (
    AGE_GROUPS.find((g) => age >= g.minAge && age <= g.maxAge) ||
    AGE_GROUPS[AGE_GROUPS.length - 1]
  );
}

export function getRandomWord(age: number, exclude: string[] = []): Word {
  const group = getAgeGroup(age);
  const available = group.words.filter((w) => !exclude.includes(w.word));
  if (available.length === 0) return group.words[0];
  return available[Math.floor(Math.random() * available.length)];
}
