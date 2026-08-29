// ── Quran client data layer ──────────────────────────────────────────────
// All Quranic text is fetched through our own /api/quran/* routes, which
// proxy the Quran.com API v4 (the API behind quran.com) with server-side
// caching. See lib/quran-api.ts for the upstream contract and the reason
// the previous source was replaced.
//
// Script is Uthmani only — there is deliberately no script picker.

export const SURAHS = [
  { number: 1, name: 'Al-Fatihah', arabicName: 'الفاتحة', ayahs: 7, type: 'Meccan' },
  { number: 2, name: 'Al-Baqarah', arabicName: 'البقرة', ayahs: 286, type: 'Medinan' },
  { number: 3, name: "Ali 'Imran", arabicName: 'آل عمران', ayahs: 200, type: 'Medinan' },
  { number: 4, name: 'An-Nisa', arabicName: 'النساء', ayahs: 176, type: 'Medinan' },
  { number: 5, name: "Al-Ma'idah", arabicName: 'المائدة', ayahs: 120, type: 'Medinan' },
  { number: 6, name: "Al-An'am", arabicName: 'الأنعام', ayahs: 165, type: 'Meccan' },
  { number: 7, name: "Al-A'raf", arabicName: 'الأعراف', ayahs: 206, type: 'Meccan' },
  { number: 8, name: 'Al-Anfal', arabicName: 'الأنفال', ayahs: 75, type: 'Medinan' },
  { number: 9, name: 'At-Tawbah', arabicName: 'التوبة', ayahs: 129, type: 'Medinan' },
  { number: 10, name: 'Yunus', arabicName: 'يونس', ayahs: 109, type: 'Meccan' },
  { number: 11, name: 'Hud', arabicName: 'هود', ayahs: 123, type: 'Meccan' },
  { number: 12, name: 'Yusuf', arabicName: 'يوسف', ayahs: 111, type: 'Meccan' },
  { number: 13, name: "Ar-Ra'd", arabicName: 'الرعد', ayahs: 43, type: 'Medinan' },
  { number: 14, name: 'Ibrahim', arabicName: 'ابراهيم', ayahs: 52, type: 'Meccan' },
  { number: 15, name: 'Al-Hijr', arabicName: 'الحجر', ayahs: 99, type: 'Meccan' },
  { number: 16, name: 'An-Nahl', arabicName: 'النحل', ayahs: 128, type: 'Meccan' },
  { number: 17, name: 'Al-Isra', arabicName: 'الإسراء', ayahs: 111, type: 'Meccan' },
  { number: 18, name: 'Al-Kahf', arabicName: 'الكهف', ayahs: 110, type: 'Meccan' },
  { number: 19, name: 'Maryam', arabicName: 'مريم', ayahs: 98, type: 'Meccan' },
  { number: 20, name: 'Taha', arabicName: 'طه', ayahs: 135, type: 'Meccan' },
  { number: 21, name: 'Al-Anbya', arabicName: 'الأنبياء', ayahs: 112, type: 'Meccan' },
  { number: 22, name: 'Al-Hajj', arabicName: 'الحج', ayahs: 78, type: 'Medinan' },
  { number: 23, name: "Al-Mu'minun", arabicName: 'المؤمنون', ayahs: 118, type: 'Meccan' },
  { number: 24, name: 'An-Nur', arabicName: 'النور', ayahs: 64, type: 'Medinan' },
  { number: 25, name: 'Al-Furqan', arabicName: 'الفرقان', ayahs: 77, type: 'Meccan' },
  { number: 26, name: "Ash-Shu'ara", arabicName: 'الشعراء', ayahs: 227, type: 'Meccan' },
  { number: 27, name: 'An-Naml', arabicName: 'النمل', ayahs: 93, type: 'Meccan' },
  { number: 28, name: 'Al-Qasas', arabicName: 'القصص', ayahs: 88, type: 'Meccan' },
  { number: 29, name: 'Al-Ankabut', arabicName: 'العنكبوت', ayahs: 69, type: 'Meccan' },
  { number: 30, name: 'Ar-Rum', arabicName: 'الروم', ayahs: 60, type: 'Meccan' },
  { number: 31, name: 'Luqman', arabicName: 'لقمان', ayahs: 34, type: 'Meccan' },
  { number: 32, name: 'As-Sajdah', arabicName: 'السجدة', ayahs: 30, type: 'Meccan' },
  { number: 33, name: 'Al-Ahzab', arabicName: 'الأحزاب', ayahs: 73, type: 'Medinan' },
  { number: 34, name: 'Saba', arabicName: 'سبأ', ayahs: 54, type: 'Meccan' },
  { number: 35, name: 'Fatir', arabicName: 'فاطر', ayahs: 45, type: 'Meccan' },
  { number: 36, name: 'Ya-Sin', arabicName: 'يس', ayahs: 83, type: 'Meccan' },
  { number: 37, name: 'As-Saffat', arabicName: 'الصافات', ayahs: 182, type: 'Meccan' },
  { number: 38, name: 'Sad', arabicName: 'ص', ayahs: 88, type: 'Meccan' },
  { number: 39, name: 'Az-Zumar', arabicName: 'الزمر', ayahs: 75, type: 'Meccan' },
  { number: 40, name: 'Ghafir', arabicName: 'غافر', ayahs: 85, type: 'Meccan' },
  { number: 41, name: 'Fussilat', arabicName: 'فصلت', ayahs: 54, type: 'Meccan' },
  { number: 42, name: 'Ash-Shuraa', arabicName: 'الشورى', ayahs: 53, type: 'Meccan' },
  { number: 43, name: 'Az-Zukhruf', arabicName: 'الزخرف', ayahs: 89, type: 'Meccan' },
  { number: 44, name: 'Ad-Dukhan', arabicName: 'الدخان', ayahs: 59, type: 'Meccan' },
  { number: 45, name: 'Al-Jathiyah', arabicName: 'الجاثية', ayahs: 37, type: 'Meccan' },
  { number: 46, name: 'Al-Ahqaf', arabicName: 'الأحقاف', ayahs: 35, type: 'Meccan' },
  { number: 47, name: 'Muhammad', arabicName: 'محمد', ayahs: 38, type: 'Medinan' },
  { number: 48, name: 'Al-Fath', arabicName: 'الفتح', ayahs: 29, type: 'Medinan' },
  { number: 49, name: 'Al-Hujurat', arabicName: 'الحجرات', ayahs: 18, type: 'Medinan' },
  { number: 50, name: 'Qaf', arabicName: 'ق', ayahs: 45, type: 'Meccan' },
  { number: 51, name: 'Adh-Dhariyat', arabicName: 'الذاريات', ayahs: 60, type: 'Meccan' },
  { number: 52, name: 'At-Tur', arabicName: 'الطور', ayahs: 49, type: 'Meccan' },
  { number: 53, name: 'An-Najm', arabicName: 'النجم', ayahs: 62, type: 'Meccan' },
  { number: 54, name: 'Al-Qamar', arabicName: 'القمر', ayahs: 55, type: 'Meccan' },
  { number: 55, name: 'Ar-Rahman', arabicName: 'الرحمن', ayahs: 78, type: 'Medinan' },
  { number: 56, name: "Al-Waqi'ah", arabicName: 'الواقعة', ayahs: 96, type: 'Meccan' },
  { number: 57, name: 'Al-Hadid', arabicName: 'الحديد', ayahs: 29, type: 'Medinan' },
  { number: 58, name: 'Al-Mujadila', arabicName: 'المجادلة', ayahs: 22, type: 'Medinan' },
  { number: 59, name: 'Al-Hashr', arabicName: 'الحشر', ayahs: 24, type: 'Medinan' },
  { number: 60, name: 'Al-Mumtahanah', arabicName: 'الممتحنة', ayahs: 13, type: 'Medinan' },
  { number: 61, name: 'As-Saf', arabicName: 'الصف', ayahs: 14, type: 'Medinan' },
  { number: 62, name: "Al-Jumu'ah", arabicName: 'الجمعة', ayahs: 11, type: 'Medinan' },
  { number: 63, name: 'Al-Munafiqun', arabicName: 'المنافقون', ayahs: 11, type: 'Medinan' },
  { number: 64, name: 'At-Taghabun', arabicName: 'التغابن', ayahs: 18, type: 'Medinan' },
  { number: 65, name: 'At-Talaq', arabicName: 'الطلاق', ayahs: 12, type: 'Medinan' },
  { number: 66, name: 'At-Tahrim', arabicName: 'التحريم', ayahs: 12, type: 'Medinan' },
  { number: 67, name: 'Al-Mulk', arabicName: 'الملك', ayahs: 30, type: 'Meccan' },
  { number: 68, name: 'Al-Qalam', arabicName: 'القلم', ayahs: 52, type: 'Meccan' },
  { number: 69, name: 'Al-Haqqah', arabicName: 'الحاقة', ayahs: 52, type: 'Meccan' },
  { number: 70, name: "Al-Ma'arij", arabicName: 'المعارج', ayahs: 44, type: 'Meccan' },
  { number: 71, name: 'Nuh', arabicName: 'نوح', ayahs: 28, type: 'Meccan' },
  { number: 72, name: 'Al-Jinn', arabicName: 'الجن', ayahs: 28, type: 'Meccan' },
  { number: 73, name: 'Al-Muzzammil', arabicName: 'المزمل', ayahs: 20, type: 'Meccan' },
  { number: 74, name: 'Al-Muddaththir', arabicName: 'المدثر', ayahs: 56, type: 'Meccan' },
  { number: 75, name: 'Al-Qiyamah', arabicName: 'القيامة', ayahs: 40, type: 'Meccan' },
  { number: 76, name: 'Al-Insan', arabicName: 'الانسان', ayahs: 31, type: 'Medinan' },
  { number: 77, name: 'Al-Mursalat', arabicName: 'المرسلات', ayahs: 50, type: 'Meccan' },
  { number: 78, name: 'An-Naba', arabicName: 'النبأ', ayahs: 40, type: 'Meccan' },
  { number: 79, name: "An-Nazi'at", arabicName: 'النازعات', ayahs: 46, type: 'Meccan' },
  { number: 80, name: 'Abasa', arabicName: 'عبس', ayahs: 42, type: 'Meccan' },
  { number: 81, name: 'At-Takwir', arabicName: 'التكوير', ayahs: 29, type: 'Meccan' },
  { number: 82, name: 'Al-Infitar', arabicName: 'الإنفطار', ayahs: 19, type: 'Meccan' },
  { number: 83, name: 'Al-Mutaffifin', arabicName: 'المطففين', ayahs: 36, type: 'Meccan' },
  { number: 84, name: 'Al-Inshiqaq', arabicName: 'الإنشقاق', ayahs: 25, type: 'Meccan' },
  { number: 85, name: 'Al-Buruj', arabicName: 'البروج', ayahs: 22, type: 'Meccan' },
  { number: 86, name: 'At-Tariq', arabicName: 'الطارق', ayahs: 17, type: 'Meccan' },
  { number: 87, name: "Al-A'la", arabicName: 'الأعلى', ayahs: 19, type: 'Meccan' },
  { number: 88, name: 'Al-Ghashiyah', arabicName: 'الغاشية', ayahs: 26, type: 'Meccan' },
  { number: 89, name: 'Al-Fajr', arabicName: 'الفجر', ayahs: 30, type: 'Meccan' },
  { number: 90, name: 'Al-Balad', arabicName: 'البلد', ayahs: 20, type: 'Meccan' },
  { number: 91, name: 'Ash-Shams', arabicName: 'الشمس', ayahs: 15, type: 'Meccan' },
  { number: 92, name: 'Al-Layl', arabicName: 'الليل', ayahs: 21, type: 'Meccan' },
  { number: 93, name: 'Ad-Duhaa', arabicName: 'الضحى', ayahs: 11, type: 'Meccan' },
  { number: 94, name: 'Ash-Sharh', arabicName: 'الشرح', ayahs: 8, type: 'Meccan' },
  { number: 95, name: 'At-Tin', arabicName: 'التين', ayahs: 8, type: 'Meccan' },
  { number: 96, name: "Al-'Alaq", arabicName: 'العلق', ayahs: 19, type: 'Meccan' },
  { number: 97, name: 'Al-Qadr', arabicName: 'القدر', ayahs: 5, type: 'Meccan' },
  { number: 98, name: 'Al-Bayyinah', arabicName: 'البينة', ayahs: 8, type: 'Medinan' },
  { number: 99, name: 'Az-Zalzalah', arabicName: 'الزلزلة', ayahs: 8, type: 'Medinan' },
  { number: 100, name: "Al-'Adiyat", arabicName: 'العاديات', ayahs: 11, type: 'Meccan' },
  { number: 101, name: "Al-Qari'ah", arabicName: 'القارعة', ayahs: 11, type: 'Meccan' },
  { number: 102, name: 'At-Takathur', arabicName: 'التكاثر', ayahs: 8, type: 'Meccan' },
  { number: 103, name: "Al-'Asr", arabicName: 'العصر', ayahs: 3, type: 'Meccan' },
  { number: 104, name: 'Al-Humazah', arabicName: 'الهمزة', ayahs: 9, type: 'Meccan' },
  { number: 105, name: 'Al-Fil', arabicName: 'الفيل', ayahs: 5, type: 'Meccan' },
  { number: 106, name: 'Quraysh', arabicName: 'قريش', ayahs: 4, type: 'Meccan' },
  { number: 107, name: "Al-Ma'un", arabicName: 'الماعون', ayahs: 7, type: 'Meccan' },
  { number: 108, name: 'Al-Kawthar', arabicName: 'الكوثر', ayahs: 3, type: 'Meccan' },
  { number: 109, name: 'Al-Kafirun', arabicName: 'الكافرون', ayahs: 6, type: 'Meccan' },
  { number: 110, name: 'An-Nasr', arabicName: 'النصر', ayahs: 3, type: 'Medinan' },
  { number: 111, name: 'Al-Masad', arabicName: 'المسد', ayahs: 5, type: 'Meccan' },
  { number: 112, name: 'Al-Ikhlas', arabicName: 'الإخلاص', ayahs: 4, type: 'Meccan' },
  { number: 113, name: 'Al-Falaq', arabicName: 'الفلق', ayahs: 5, type: 'Meccan' },
  { number: 114, name: 'An-Nas', arabicName: 'الناس', ayahs: 6, type: 'Meccan' },
] as const

export type Chapter = {
  id: number
  name_simple: string
  name_arabic: string
  translated_name: string
  verses_count: number
  revelation_place: string
  bismillah_pre: boolean
}

export type Verse = { number: number; key: string; uthmani: string; translation: string }

export type SurahPayload = {
  chapter: Chapter
  showBismillah: boolean
  bismillah: string
  verses: Verse[]
  translationId: number
}

export type TranslationOption = { id: number; name: string; author: string }

// Quran.com's own default translation.
export const DEFAULT_TRANSLATION_ID = 131

export async function fetchChapters(): Promise<Chapter[] | null> {
  try {
    const res = await fetch('/api/quran/chapters')
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json.chapters) ? json.chapters : null
  } catch {
    return null
  }
}

export async function fetchTranslations(): Promise<TranslationOption[]> {
  try {
    const res = await fetch('/api/quran/translations')
    if (!res.ok) return []
    const json = await res.json()
    return json.translations || []
  } catch {
    return []
  }
}

// Returns null on ANY failure — the reader then shows an honest error.
// It must never render partial or uncertain Quranic text.
export async function fetchSurah(id: number, translationId: number): Promise<SurahPayload | null> {
  try {
    const res = await fetch(`/api/quran/surah/${id}?translation=${translationId}`)
    if (!res.ok) return null
    const json = await res.json()
    if (!json?.verses?.length) return null
    return json as SurahPayload
  } catch {
    return null
  }
}

export async function fetchTafsir(surah: number, ayah: number): Promise<{ text: string; name: string } | null> {
  try {
    const res = await fetch(`/api/quran/tafsir/${surah}/${ayah}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.tafsir || null
  } catch {
    return null
  }
}

// Arabic-Indic numerals for the end-of-ayah marker (١٢٣…)
export function toArabicNumber(n: number): string {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}
