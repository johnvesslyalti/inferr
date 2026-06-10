// Canonical list of selectable interest tags for onboarding and in-app edits.
// Keep in sync; used for both the full onboarding flow and the InterestsDialog.
export const INTEREST_TAGS = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Rust',
  'React',
  'Next.js',
  'Node.js',
  'NestJS',
  'Docker',
  'Kubernetes',
  'AWS',
  'PostgreSQL',
  'Redis',
  'AI / ML',
  'LLMs',
  'RAG',
  'System Design',
  'DevOps',
  'Security',
];

export function getCanonicalTags(tags: string[]): string[] {
  const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  return tags.map((t) => {
    const normalized = normalize(t);
    const matched = INTEREST_TAGS.find((canonical) => {
      const normalizedCanonical = normalize(canonical);
      return (
        normalizedCanonical === normalized ||
        normalizedCanonical.startsWith(normalized) ||
        normalized.startsWith(normalizedCanonical)
      );
    });
    return matched ?? t;
  });
}
