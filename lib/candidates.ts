export type Candidate = { id: number; name: string };

export const CANDIDATES: readonly Candidate[] = [
  { id: 1, name: "Pad Thai" },
  { id: 2, name: "American Fried Rice" },
  { id: 3, name: "Tom Yum Goong (Spicy Shrimp Soup)" },
  { id: 4, name: "Tom Kha Gai (Coconut Chicken Soup)" },
  { id: 5, name: "Green Curry" },
  { id: 6, name: "Massaman Curry" },
  { id: 7, name: "Sour Curry" },
  { id: 8, name: "Panang Curry" },
  { id: 9, name: "Red Curry with Roasted Duck" },
  { id: 10, name: "Hainanese Chicken Rice" },
  { id: 11, name: "Braised Pork Leg on Rice" },
  { id: 12, name: "Shrimp Paste Fried Rice" },
  { id: 13, name: "Thai Chicken Biryani" },
  { id: 14, name: "Grilled Pork Neck" },
  { id: 15, name: "Thai Grilled Chicken" },
  { id: 16, name: "Thai Omelet" },
  { id: 17, name: "Thai Five-Spice Braised Eggs" },
  { id: 18, name: "Boat Noodles" },
  { id: 19, name: "Thai Tom Yum Noodle Soup" },
  { id: 20, name: "Thai Glass Noodle Salad" },
  { id: 21, name: "Thai Fried Fish with Fish Sauce" },
  { id: 22, name: "Gaeng Tai Pla" },
  { id: 23, name: "Hang Lay Curry" },
  { id: 24, name: "Spicy Thai Prawn Salad" },
  { id: 25, name: "Thai Fish Cakes" },
  { id: 26, name: "Mango Sticky Rice" },
];

/** Placeholder art. Swap these for illustrations later; nothing else references emoji directly. */
export const DISH_ART: Record<number, string> = {
  1: "🍜", 2: "🍳", 3: "🦐", 4: "🥥", 5: "🟢", 6: "🥔", 7: "🍋", 8: "🍛", 9: "🦆",
  10: "🍚", 11: "🐖", 12: "🍤", 13: "🍛", 14: "🥩", 15: "🍗", 16: "🥚", 17: "🥚",
  18: "🛶", 19: "🍲", 20: "🥗", 21: "🐟", 22: "🌶️", 23: "🫕", 24: "🦞", 25: "🍥", 26: "🥭",
};

export function candidate(id: number): Candidate | undefined {
  return CANDIDATES[id - 1];
}

export function dishArt(id: number): string {
  return DISH_ART[id] ?? "🍽️";
}

/** Short name without the parenthetical, for stamps and tight spaces. */
export function shortName(id: number): string {
  return candidate(id)?.name.replace(/\s*\(.*\)$/, "") ?? "Unknown";
}
