/* ══════════════════════════════════════════════════════════
   CONTRACT REGISTRY

   Single source of truth mapping each contract type to its schema,
   hybrid template, deterministic-verification config, and any
   type-specific business rules (guards, extra warnings, law fallback).
   Adding a new contract type is a registry entry plus a route line.
══════════════════════════════════════════════════════════ */

import {
  MIN_WAGE_JD,
  employmentTemplate,
  EMPLOYMENT_REQUIRED,
  type EmploymentData,
  rentalTemplate,
  RENTAL_REQUIRED,
  type RentalData,
  serviceTemplate,
  SERVICE_REQUIRED,
  type ServiceData,
  ndaTemplate,
  NDA_REQUIRED,
  type NdaData,
  supplierTemplate,
  SUPPLIER_REQUIRED,
  type SupplierData,
  type ContractTemplate,
} from "../clauses";
import { JORDAN_LABOR_LAW_FULL } from "../data/jordan-labor-law";
import { ValidationError } from "../../../core/errors";

export interface ContractConfig<T extends Record<string, unknown>> {
  type: string;
  template: ContractTemplate<T>;
  required: readonly string[];
  minLength: number;
  errorLabel: string;
  incompleteError: string;
  failureError: string;
  /** Saved law text to use when the live law system is unavailable. */
  fallbackLaw?: string;
  /** Business-rule guard run before generation; throws on violation. */
  guard?: (data: T) => void;
  /** Non-blocking advisory warnings surfaced in the `done` event. */
  extraWarnings?: (data: T) => string[];
}

export type AnyContractConfig = ContractConfig<Record<string, unknown>>;

function define<T extends Record<string, unknown>>(
  config: ContractConfig<T>,
): AnyContractConfig {
  return config as unknown as AnyContractConfig;
}

export const contractRegistry: Record<string, AnyContractConfig> = {
  employment: define<EmploymentData>({
    type: "employment",
    template: employmentTemplate,
    required: EMPLOYMENT_REQUIRED,
    minLength: 2000,
    errorLabel: "Employment contract generation failed",
    incompleteError: "لم يستوفِ العقد المتطلبات القانونية",
    failureError: "فشل توليد العقد. يرجى المحاولة مرة أخرى.",
    fallbackLaw: JORDAN_LABOR_LAW_FULL,
    guard: (data) => {
      if (data.probationPeriodDays > 90) {
        throw new ValidationError(
          "فترة التجربة لا يجوز أن تتجاوز 90 يوماً وفقاً للمادة (35)",
        );
      }
    },
    extraWarnings: (data) => {
      if (data.monthlySalary < MIN_WAGE_JD) {
        return [
          `الأجر (${data.monthlySalary} د.أ) أقل من الحد الأدنى القانوني (${MIN_WAGE_JD} د.أ)`,
        ];
      }
      return [];
    },
  }),

  rental: define<RentalData>({
    type: "rental",
    template: rentalTemplate,
    required: RENTAL_REQUIRED,
    minLength: 1500,
    errorLabel: "Rental contract generation failed",
    incompleteError: "لم يكتمل توليد العقد",
    failureError: "فشل توليد عقد الإيجار.",
  }),

  service: define<ServiceData>({
    type: "service",
    template: serviceTemplate,
    required: SERVICE_REQUIRED,
    minLength: 1500,
    errorLabel: "Service contract generation failed",
    incompleteError: "لم يكتمل توليد العقد",
    failureError: "فشل توليد عقد الخدمات.",
  }),

  nda: define<NdaData>({
    type: "nda",
    template: ndaTemplate,
    required: NDA_REQUIRED,
    minLength: 1500,
    errorLabel: "NDA generation failed",
    incompleteError: "لم يكتمل توليد الاتفاقية",
    failureError: "فشل توليد اتفاقية السرية.",
  }),

  supplier: define<SupplierData>({
    type: "supplier",
    template: supplierTemplate,
    required: SUPPLIER_REQUIRED,
    minLength: 1500,
    errorLabel: "Supplier contract generation failed",
    incompleteError: "لم يكتمل توليد العقد",
    failureError: "فشل توليد عقد التوريد.",
  }),
};
