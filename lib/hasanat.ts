// ── Counting letters, and what the count means ───────────────────────────
// The reader shows how many letters of the Qur'an someone has read, and the
// hasanat that the narration attaches to them:
//
//   "Whoever reads a letter from the Book of Allah receives a hasanah, and
//    that hasanah is multiplied by ten."  — Jami' at-Tirmidhi 2910
//
// Two decisions in how this is implemented, both deliberate:
//
// 1. LETTERS, NOT MARKS. The narration speaks of حرف — a letter. So harakat,
//    shadda, sukun, maddah, the waqf signs and the superscript alef are not
//    counted: they are notation over the letters, not letters themselves.
//    Ayah numerals and spaces obviously are not either.
//
// 2. THE LETTER COUNT IS THE HARD NUMBER; THE HASANAT ARE NOT. Letters read
//    is a fact we can compute from the text. Reward is not ours to tally, so
//    the UI presents the multiplied figure as what the narration promises —
//    never as a balance the app has verified or awarded. Keep that framing
//    wherever this is displayed.
//
// Counting runs on the SERVER against the Complex's own text, so the figure
// cannot be inflated by the client. A counter you can lie to is not a
// counter worth showing.

// Arabic letters only.
//   0621-063A  hamza, the alef forms, beh … ghain, teh marbuta, alef maksura
//   0641-064A  feh … yeh
//   0671       alef wasla (ٱ) — a letter in this orthography
// Deliberately excluded: 0640 tatweel (a spacer), 064B-065F harakat and
// hamza marks, 0670 superscript alef, 06D6-06ED Quranic annotation signs,
// 0660-0669 digits.
const ARABIC_LETTERS = /[ء-غف-يٱ]/g

export function countLetters(text: string): number {
  if (!text) return 0
  const m = text.match(ARABIC_LETTERS)
  return m ? m.length : 0
}

// Per the narration above. Used only to derive the displayed figure.
export const HASANAT_PER_LETTER = 10

export const HASANAT_SOURCE = 'Jami’ at-Tirmidhi 2910'

export function hasanatFor(letters: number): number {
  return letters * HASANAT_PER_LETTER
}

// The upper bound in quran-progress.sql's CHECK. The longest verse in the
// mushaf (2:282) is well under this; the constraint exists so a bug can
// never write an absurd number into someone's history.
export const MAX_LETTERS_PER_VERSE = 3000
