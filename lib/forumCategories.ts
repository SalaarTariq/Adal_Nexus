export const FORUM_CATEGORIES = [
  'Constitutional',
  'Criminal',
  'Corporate',
  'Family',
  'Cyber',
  'Tax',
  'Career Advice',
  'Legal Awareness',
] as const;

export type ForumCategory = (typeof FORUM_CATEGORIES)[number];

export function isForumCategory(value: string): value is ForumCategory {
  return (FORUM_CATEGORIES as readonly string[]).includes(value);
}
