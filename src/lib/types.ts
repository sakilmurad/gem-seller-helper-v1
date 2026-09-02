/* Shared types and utilities used across components */

export type Signatory = {
  names: string;
  designations: string;
  sign_stamp_urls: string;
};

export type CompanySettings = {
  companyName: string;
  companyAddress: string;
  PAN: string;
  GST: string;
  MSME: string;
  letterheadUrl: string;
  marginLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  signatories: Signatory[];
};

export interface TemplateVariable {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'dynamic_table';
  columns?: string; // Comma separated column names for dynamic_table
  required: boolean;
  show_in_form: boolean;
}

export interface Template {
  id: string;
  createdOn: string;
  name: string;
  description: string;
  content: string;
  variables: string | TemplateVariable[];
}

export interface DocumentRecord {
  sNo: string;
  createdOn: string;
  templateId: string;
  title: string;
  variableValues: string;
  pdfUrl: string;
}

/* ---- Google Apps Script bridge ---- */

declare global {
  interface Window {
    google?: { script?: { run: unknown } };
  }
}

export const serverCall = <T,>(name: string, payload?: unknown) =>
  new Promise<T>((resolve, reject) => {
    const runner = window.google?.script?.run as
      | {
          withSuccessHandler: (fn: (value: T) => void) => {
            withFailureHandler: (
              fn: (error: Error) => void,
            ) => Record<string, (...args: unknown[]) => void>;
          };
        }
      | undefined;

    if (!runner) {
      reject(new Error('Google Apps Script is not available in local preview.'));
      return;
    }

    const chain = runner.withSuccessHandler(resolve).withFailureHandler(reject);
    chain[name](...(payload === undefined ? [] : [payload]));
  });

/** Parse variables field which can be string or array */
export const parseVariables = (variables: string | TemplateVariable[]): TemplateVariable[] => {
  if (Array.isArray(variables)) return variables;
  if (typeof variables === 'string') {
    try {
      return JSON.parse(variables);
    } catch {
      return [];
    }
  }
  return [];
};
