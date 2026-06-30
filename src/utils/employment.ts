export const EMPLOYMENT_CATEGORY_LABELS: Record<string, string> = {
  FULLTIME: 'Vollzeit',
  AZUBI: 'Azubi',
  PARTTIME: 'Teilzeit',
  MIDIJOB: 'Midi Job',
  MINIJOB: 'Mini Job',
  OTHER: 'Sonstige'
};

export const getEmploymentCategoryLabel = (category: string) => {
  return EMPLOYMENT_CATEGORY_LABELS[category] || category;
};
