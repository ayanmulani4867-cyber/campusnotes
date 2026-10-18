import { Subject } from '../types/index';

/**
 * Official Semester V Subjects for Computer Science & Engineering (CSE)
 * EXACT SPELLING AND COURSE CODES AS SPECIFIED
 */
export const OFFICIAL_CSE_SEM_5_SUBJECTS: Omit<Subject, 'createdAt' | 'updatedAt'>[] = [
  {
    id: '23cs3501_ajp',
    code: '23CS3501',
    name: 'Advanced Java Programming',
    description: 'Advanced Java concepts, Collections framework, Multithreading, Generics, Lambda expressions, Streams API, and Enterprise design patterns.',
    active: true,
  },
  {
    id: '23cs3502_daa',
    code: '23CS3502',
    name: 'Design Analysis and Algorithms',
    description: 'Asymptotic complexity, Divide and Conquer, Greedy algorithms, Dynamic Programming, Graph algorithms, Backtracking, and NP-Completeness.',
    active: true,
  },
  {
    id: '23cs3503_ade',
    code: '23CS3503',
    name: 'Advanced Database Engineering',
    description: 'Advanced relational modeling, Query optimization, Transaction processing, Concurrency control, Distributed databases, Indexing, and NoSQL architecture.',
    active: true,
  },
  {
    id: '23cs3504_ajp_lab',
    code: '23CS3504',
    name: 'Advanced Java Programming Laboratory',
    description: 'Practical lab implementations of Advanced Java, socket programming, JDBC connectivity, multi-threaded servers, and GUI application development.',
    active: true,
  },
  {
    id: '23cs3505_daa_lab',
    code: '23CS3505',
    name: 'Design Analysis and Algorithms Laboratory',
    description: 'Hands-on practicals implementing sorting, graph traversals, shortest path, MST, dynamic programming, and complexity verification.',
    active: true,
  },
  {
    id: '23cs3506_ade_lab',
    code: '23CS3506',
    name: 'Advanced Database Engineering Laboratory',
    description: 'Complex SQL queries, PL/SQL stored procedures, functions, packages, triggers, indexing benchmarks, and NoSQL document store experiments.',
    active: true,
  },
  {
    id: '23cs3507_pec1',
    code: '23CS3507',
    name: 'Program Elective Course-I',
    description: 'Specialized CSE elective course covering advanced domain-specific computing topics for Semester V.',
    active: true,
  },
  {
    id: '23csmdxx_mm3',
    code: '23CSMDXX',
    name: 'Multidisciplinary Minor-III',
    description: 'Interdisciplinary curriculum minor track offering cross-domain engineering principles and applications.',
    active: true,
  },
  {
    id: '23oecs31_oe3',
    code: '23OECS31',
    name: 'Open Elective III',
    description: 'Broad-interest university open elective designed for interdisciplinary academic enrichment in Semester V.',
    active: true,
  },
];

/**
 * Prohibited subjects that must NEVER appear in the catalog, seeder, or filters
 */
export const EXCLUDED_SUBJECT_NAMES = [
  'Aptitude Skills-III',
  'Language Skills-III',
  'Mini Project – III',
  'Mini Project - III',
  'Aptitude Skills',
  'Language Skills',
  'Mini Project',
];

/**
 * Filter helper to ensure no excluded or duplicate subjects appear
 */
export function sanitizeSubjects(subjects: Subject[]): Subject[] {
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();

  return subjects.filter((subject) => {
    // 1. Exclude prohibited subjects
    const isExcluded = EXCLUDED_SUBJECT_NAMES.some(
      (excluded) =>
        subject.name.toLowerCase().includes(excluded.toLowerCase()) ||
        (subject.code && subject.code.toLowerCase().includes(excluded.toLowerCase()))
    );
    if (isExcluded) return false;

    // 2. Prevent duplicate entries by code or name
    const normalizedCode = subject.code.trim().toUpperCase();
    const normalizedName = subject.name.trim().toLowerCase();

    if (seenCodes.has(normalizedCode) || seenNames.has(normalizedName)) {
      return false;
    }

    seenCodes.add(normalizedCode);
    seenNames.add(normalizedName);
    return true;
  });
}
