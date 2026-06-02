export const BASE_COLORS = [
  { name: 'Rojo',     hex: '#E53935' },
  { name: 'Amarillo', hex: '#FDD835' },
  { name: 'Azul',     hex: '#1E88E5' },
  { name: 'Blanco',   hex: '#FFFFFF' },
  { name: 'Negro',    hex: '#212121' },
]

export const RECIPES: {
  a: string; b: string; result: string; name: string; emoji: string
}[] = [
  { a: '#E53935', b: '#FDD835', result: '#FF7043', name: 'Naranja',      emoji: '🟠' },
  { a: '#E53935', b: '#1E88E5', result: '#8E24AA', name: 'Violeta',      emoji: '🟣' },
  { a: '#FDD835', b: '#1E88E5', result: '#43A047', name: 'Verde',        emoji: '🟢' },
  { a: '#E53935', b: '#FFFFFF', result: '#F48FB1', name: 'Rosa',         emoji: '🌸' },
  { a: '#FF7043', b: '#FDD835', result: '#FFCA28', name: 'Dorado',       emoji: '✨' },
  { a: '#8E24AA', b: '#1E88E5', result: '#283593', name: 'Índigo',       emoji: '💙' },
  { a: '#8E24AA', b: '#E53935', result: '#C62828', name: 'Bordo',        emoji: '❤️' },
  { a: '#43A047', b: '#FDD835', result: '#AEEA00', name: 'Verde Lima',   emoji: '💚' },
  { a: '#43A047', b: '#1E88E5', result: '#00838F', name: 'Turquesa',     emoji: '🩵' },
  { a: '#F48FB1', b: '#8E24AA', result: '#CE93D8', name: 'Lila',         emoji: '💜' },
  { a: '#FF7043', b: '#E53935', result: '#BF360C', name: 'Rojo Oscuro',  emoji: '🔴' },
  { a: '#43A047', b: '#FFFFFF', result: '#A5D6A7', name: 'Verde Claro',  emoji: '🍀' },
  { a: '#212121', b: '#FFFFFF', result: '#9E9E9E', name: 'Gris',         emoji: '⬜' },
  { a: '#1E88E5', b: '#FFFFFF', result: '#90CAF9', name: 'Celeste',      emoji: '🩵' },
  { a: '#FF7043', b: '#FFFFFF', result: '#FFCCBC', name: 'Salmón',       emoji: '🎀' },
]

export const TOTAL_MIXABLE = RECIPES.length

export function findRecipe(hexA: string, hexB: string) {
  const a = hexA.toUpperCase()
  const b = hexB.toUpperCase()
  return RECIPES.find(
    r => (r.a.toUpperCase() === a && r.b.toUpperCase() === b) ||
         (r.a.toUpperCase() === b && r.b.toUpperCase() === a)
  ) ?? null
}
