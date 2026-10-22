import { StudyMaterial, CATEGORIES } from '../types';
import { OFFICIAL_CSE_SEM_5_SUBJECTS } from '../constants/subjects';

/**
 * Ordered list of official CSE Semester 5 subject IDs to ensure
 * canonical subject order (e.g. 23CS3501 AJP -> 23CS3502 DAA -> etc.)
 */
const SUBJECT_ORDER: string[] = OFFICIAL_CSE_SEM_5_SUBJECTS.map((s) => s.id);

/**
 * Ordered list of academic categories (e.g. notes -> assignments -> experiments -> etc.)
 */
const CATEGORY_ORDER: string[] = CATEGORIES.map((c) => c.id);

/**
 * Converts Roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X) to Arabic integer
 */
function romanToInt(str: string): number | null {
  const romanMap: Record<string, number> = {
    i: 1,
    v: 5,
    x: 10,
    l: 50,
    c: 100,
    d: 500,
    m: 1000,
  };
  const s = str.toLowerCase();
  let total = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const val = romanMap[s[i]];
    if (!val) return null;
    if (val < prev) {
      total -= val;
    } else {
      total += val;
      prev = val;
    }
  }
  return total > 0 ? total : null;
}

/**
 * Extracts a numerical value from a study material for natural ascending sorting.
 * Checks explicit numeric properties first, then parses title and file name.
 */
export function extractMaterialNumber(m: Partial<StudyMaterial>): number | null {
  // 1. Explicit properties on StudyMaterial
  if (typeof m.assignmentNumber === 'number' && !isNaN(m.assignmentNumber) && m.assignmentNumber > 0) {
    return m.assignmentNumber;
  }
  if (typeof m.experimentNumber === 'number' && !isNaN(m.experimentNumber) && m.experimentNumber > 0) {
    return m.experimentNumber;
  }
  if (typeof m.unitNumber === 'number' && !isNaN(m.unitNumber) && m.unitNumber > 0) {
    return m.unitNumber;
  }

  const title = (m.title || '').trim();

  // 2. Keyword with Arabic digits: "Assignment 1", "Assignment no 5", "Assignment #3", "Unit 2", "Exp 4", "Practical 1", "PYQ 2024", etc.
  const kwMatch = title.match(
    /(?:assignment|assign|assgn|asg|unit|module|chapter|chap|part|experiment|exp|practical|prac|lab|pyq|paper|set|qb|question\s*bank)\s*(?:no\.?|#|[-_])?\s*(\d+)/i
  );
  if (kwMatch) {
    const val = parseInt(kwMatch[1], 10);
    if (!isNaN(val)) return val;
  }

  // 3. Keyword with Roman numerals: "Unit I", "Unit IV", "Module II", etc.
  const romanMatch = title.match(
    /\b(?:unit|module|chapter|chap|part|assignment|exp|practical)\s+([ivxLCDM]+)\b/i
  );
  if (romanMatch) {
    const val = romanToInt(romanMatch[1]);
    if (val !== null) return val;
  }

  // 4. Ordinal numbers: "1st assignment", "2nd unit", "3rd practical", "5th Assignment"
  const ordMatch = title.match(
    /(\d+)(?:st|nd|rd|th)\s*(?:assignment|assign|unit|module|experiment|practical|paper|lab)/i
  );
  if (ordMatch) {
    const val = parseInt(ordMatch[1], 10);
    if (!isNaN(val)) return val;
  }

  // 5. Fallback: Parse fileName
  const fn = (m.fileName || '').trim();
  const fnKw = fn.match(
    /(?:assignment|assign|unit|module|exp|practical|pyq|ajp|daa|ai)\s*[_-]?\s*(?:no\.?|#)?\s*(\d+)/i
  );
  if (fnKw) {
    const val = parseInt(fnKw[1], 10);
    if (!isNaN(val)) return val;
  }
  const fnOrd = fn.match(/(\d+)(?:st|nd|rd|th)/i);
  if (fnOrd) {
    const val = parseInt(fnOrd[1], 10);
    if (!isNaN(val)) return val;
  }

  // 6. Standalone number in title
  const standalone = title.match(/(?:^|[^\d])(\d+)(?:[^\d]|$)/);
  if (standalone) {
    const val = parseInt(standalone[1], 10);
    if (!isNaN(val)) return val;
  }

  return null;
}

const materialNumberCache = new WeakMap<object, number | null>();

/**
 * Returns cached material number or extracts and memoizes it in WeakMap
 */
export function getCachedMaterialNumber(m: Partial<StudyMaterial>): number | null {
  if (!m || typeof m !== 'object') return extractMaterialNumber(m);
  let val = materialNumberCache.get(m);
  if (val === undefined) {
    val = extractMaterialNumber(m);
    materialNumberCache.set(m, val);
  }
  return val;
}

/**
 * Universal comparator function to sort study materials in ascending order:
 * 1. Subject order (e.g. 23CS3501 AJP -> 23CS3502 DAA -> etc.)
 * 2. Category order (notes -> assignments -> experiments -> pyq -> etc.)
 * 3. Numerical value ascending (Assignment 1, 2, ... 10)
 * 4. Title natural comparison (e.g. Part A before Part B)
 * 5. Upload date ascending (createdAt older first)
 */
export function compareMaterialsAscending(a: StudyMaterial, b: StudyMaterial): number {
  // 1. Subject order
  if (a.subjectId !== b.subjectId) {
    const subIdxA = SUBJECT_ORDER.indexOf(a.subjectId);
    const subIdxB = SUBJECT_ORDER.indexOf(b.subjectId);
    if (subIdxA !== -1 && subIdxB !== -1 && subIdxA !== subIdxB) {
      return subIdxA - subIdxB;
    }
    if (subIdxA !== -1 && subIdxB === -1) return -1;
    if (subIdxA === -1 && subIdxB !== -1) return 1;
    const subCmp = (a.subjectId || '').localeCompare(b.subjectId || '');
    if (subCmp !== 0) return subCmp;
  }

  // 2. Category order
  if (a.category !== b.category) {
    const catIdxA = CATEGORY_ORDER.indexOf(a.category);
    const catIdxB = CATEGORY_ORDER.indexOf(b.category);
    if (catIdxA !== -1 && catIdxB !== -1 && catIdxA !== catIdxB) {
      return catIdxA - catIdxB;
    }
    const catCmp = (a.category || '').localeCompare(b.category || '');
    if (catCmp !== 0) return catCmp;
  }

  // 3. Numerical value (numerical, not alphabetical: 2 before 10)
  const numA = getCachedMaterialNumber(a);
  const numB = getCachedMaterialNumber(b);
  if (numA !== null && numB !== null) {
    if (numA !== numB) return numA - numB;
  } else if (numA !== null) {
    return -1;
  } else if (numB !== null) {
    return 1;
  }

  // 4. Secondary sort: Title with natural numerical sensitivity
  const titleCmp = (a.title || '').localeCompare(b.title || '', undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (titleCmp !== 0) return titleCmp;

  // 5. Secondary sort: Upload date ascending
  const dateDiff = (a.createdAt || 0) - (b.createdAt || 0);
  if (dateDiff !== 0) return dateDiff;

  return (a.id || '').localeCompare(b.id || '');
}

/**
 * Returns a new array of study materials sorted in ascending order.
 */
export function sortStudyMaterialsAscending(materials: StudyMaterial[]): StudyMaterial[] {
  return [...materials].sort(compareMaterialsAscending);
}
