DELETE FROM user_interests
WHERE NOT (tags <@ ARRAY[
  'AI / ML',
  'Web Development',
  'DevOps',
  'Security',
  'Databases',
  'System Design',
  'Open Source',
  'Mobile Development',
  'Hardware',
  'Blockchain'
]);
