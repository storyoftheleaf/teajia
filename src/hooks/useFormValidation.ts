import { useState, useCallback } from 'react';

type ValidationRule = (value: string) => string; // Returns error message or empty string

interface FieldConfig {
  [field: string]: ValidationRule;
}

/**
 * Reusable form validation hook.
 *
 * Usage:
 *   const { values, errors, touched, handleChange, handleBlur, isValid, resetForm } =
 *     useFormValidation({ name: '', email: '' }, {
 *       name: (v) => v.trim() ? '' : 'Name is required',
 *       email: (v) => v.trim() ? '' : 'Email is required',
 *     });
 */
export function useFormValidation<T extends Record<string, string>>(
  initialValues: T,
  rules: Partial<Record<keyof T, ValidationRule>> = {},
) {
  const [values, setValues] = useState<T>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const validate = useCallback(
    (field: keyof T, value: string): string => {
      const rule = rules[field];
      return rule ? rule(value) : '';
    },
    [rules],
  );

  const handleChange = useCallback(
    (field: keyof T, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      if (touched[field]) {
        setErrors((prev) => ({ ...prev, [field]: validate(field, value) }));
      }
    },
    [touched, validate],
  );

  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      setErrors((prev) => ({ ...prev, [field]: validate(field, values[field]) }));
    },
    [values, validate],
  );

  const isValid = Object.keys(rules).every((field) => {
    const rule = rules[field as keyof T];
    return rule ? !rule(values[field as keyof T]) : true;
  });

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setTouched({});
    setErrors({});
  }, [initialValues]);

  return { values, errors, touched, handleChange, handleBlur, isValid, resetForm, setValues };
}
