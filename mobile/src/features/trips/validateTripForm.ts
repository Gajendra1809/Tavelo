export type TripFormValues = {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type TripFormErrors = Partial<Record<keyof TripFormValues, string>>;

export const emptyTripForm: TripFormValues = {
  name: '',
  destination: '',
  startDate: '',
  endDate: '',
  description: '',
};

export function validateTripForm(values: TripFormValues): TripFormErrors {
  const errors: TripFormErrors = {};
  const name = values.name.trim();
  const destination = values.destination.trim();
  const description = values.description.trim();

  if (!name) {
    errors.name = 'Enter a trip name.';
  } else if (name.length > 80) {
    errors.name = 'Use 80 characters or fewer.';
  }

  if (!destination) {
    errors.destination = 'Enter a destination.';
  } else if (destination.length > 120) {
    errors.destination = 'Use 120 characters or fewer.';
  }

  if (!values.startDate) {
    errors.startDate = 'Choose a start date.';
  }

  if (!values.endDate) {
    errors.endDate = 'Choose an end date.';
  } else if (values.startDate && values.endDate < values.startDate) {
    errors.endDate = 'End date must be on or after the start date.';
  }

  if (description.length > 500) {
    errors.description = 'Use 500 characters or fewer.';
  }

  return errors;
}

export function isTripFormDirty(values: TripFormValues): boolean {
  return Object.values(values).some((value) => value.trim().length > 0);
}

export function isTripFormChanged(values: TripFormValues, initial: TripFormValues): boolean {
  const keys = Object.keys(values) as (keyof TripFormValues)[];
  return keys.some((key) => values[key].trim() !== initial[key].trim());
}
