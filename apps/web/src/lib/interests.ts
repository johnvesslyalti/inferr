// Canonical list of selectable interest tags for onboarding and in-app edits.
// Keep in sync; used for both the full onboarding flow and the InterestsDialog.
export const INTEREST_TAGS = [
  'AI / ML',
  'Web Development',
  'DevOps',
  'Security',
  'Databases',
  'System Design',
  'Open Source',
  'Mobile Development',
  'Hardware',
  'Blockchain',
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
