/**
 * Lightweight Route and Chunk Prefetcher.
 * Preloads JavaScript route chunks on pointer hover or touch start
 * so route transitions feel instantaneous without loading all routes up front.
 */

const prefetchedRoutes = new Set<string>();

export function prefetchRoute(
  routeName:
    | 'materials'
    | 'materialDetail'
    | 'subjects'
    | 'subjectDetail'
    | 'category'
    | 'about'
    | 'shareAssignment'
): void {
  if (prefetchedRoutes.has(routeName)) return;
  prefetchedRoutes.add(routeName);

  switch (routeName) {
    case 'materials':
      import('../pages/MaterialsPage');
      break;
    case 'materialDetail':
      import('../pages/MaterialDetailPage');
      break;
    case 'subjects':
      import('../pages/SubjectsPage');
      break;
    case 'subjectDetail':
      import('../pages/SubjectDetailPage');
      break;
    case 'category':
      import('../pages/CategoryPage');
      break;
    case 'about':
      import('../pages/AboutPage');
      break;
    case 'shareAssignment':
      import('../pages/ShareAssignmentPage');
      break;
  }
}
