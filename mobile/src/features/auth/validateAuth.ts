export type RegisterValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginValues = {
  email: string;
  password: string;
};

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(values: LoginValues): FieldErrors<LoginValues> {
  const errors: FieldErrors<LoginValues> = {};
  const email = values.email.trim().toLowerCase();
  if (!emailPattern.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!values.password) {
    errors.password = 'Enter your password.';
  }
  return errors;
}

export function validateRegister(values: RegisterValues): FieldErrors<RegisterValues> {
  const errors: FieldErrors<RegisterValues> = {};
  if (!values.name.trim()) {
    errors.name = 'Enter your name.';
  } else if (values.name.trim().length > 80) {
    errors.name = 'Use 80 characters or fewer.';
  }

  const email = values.email.trim().toLowerCase();
  if (!emailPattern.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (values.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  } else if (values.password.length > 72) {
    errors.password = 'Use 72 characters or fewer.';
  } else if (!/[A-Za-z]/.test(values.password) || !/[0-9]/.test(values.password)) {
    errors.password = 'Include at least one letter and one number.';
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}
