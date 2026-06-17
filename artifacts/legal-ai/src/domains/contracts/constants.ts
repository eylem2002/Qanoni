export const MIN_WAGE = 290;

export const BENEFITS_OPTIONS = [
  { id: "تأمين اجتماعي", label: "تأمين اجتماعي (إلزامي)" },
  { id: "تأمين صحي", label: "تأمين صحي" },
  { id: "بدل مواصلات", label: "بدل مواصلات" },
  { id: "بدل سكن", label: "بدل سكن" },
  { id: "بدل غلاء معيشة", label: "بدل غلاء معيشة" },
  { id: "صندوق ادخار", label: "صندوق ادخار" },
  { id: "صندوق تقاعد", label: "صندوق تقاعد" },
  { id: "تذاكر سفر للإجازة", label: "تذاكر سفر" },
];

export const CONTRACT_TYPES = [
  { value: "employment", label: "عقد عمل" },
  { value: "rental", label: "عقد إيجار" },
  { value: "service", label: "عقد خدمات" },
  { value: "nda", label: "اتفاقية سرية" },
  { value: "supplier", label: "عقد مورد" },
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number]["value"];

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  employment: "عقد عمل",
  rental: "عقد إيجار",
  service: "عقد خدمات",
  nda: "اتفاقية سرية",
  supplier: "عقد مورد",
};

export const LOADING_MESSAGES: Record<ContractType, string> = {
  employment: "صياغة بنود عقد العمل...",
  rental: "صياغة بنود عقد الإيجار...",
  service: "صياغة بنود عقد الخدمات...",
  nda: "صياغة اتفاقية عدم الإفصاح...",
  supplier: "صياغة بنود عقد التوريد...",
};
