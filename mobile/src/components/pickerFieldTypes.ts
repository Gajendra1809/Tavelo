export type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  minimumDate?: string;
  maximumDate?: string;
  placeholder?: string;
  allowClear?: boolean;
};

export type TimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  allowClear?: boolean;
};
