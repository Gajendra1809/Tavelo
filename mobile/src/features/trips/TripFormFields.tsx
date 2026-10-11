import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import type { TripFormErrors, TripFormValues } from './validateTripForm';

type TripFormFieldsProps = {
  values: TripFormValues;
  errors: TripFormErrors;
  onChange: (key: keyof TripFormValues, value: string) => void;
};

export function TripFormFields({ values, errors, onChange }: TripFormFieldsProps) {
  return (
    <>
      <FormField
        label="Trip name"
        value={values.name}
        onChangeText={(value) => onChange('name', value)}
        error={errors.name}
        placeholder="Summer with friends"
      />
      <FormField
        label="Destination"
        value={values.destination}
        onChangeText={(value) => onChange('destination', value)}
        error={errors.destination}
        placeholder="City or region"
      />
      <DateField
        label="Start date"
        value={values.startDate}
        onChange={(value) => onChange('startDate', value)}
        error={errors.startDate}
      />
      <DateField
        label="End date"
        value={values.endDate}
        onChange={(value) => onChange('endDate', value)}
        error={errors.endDate}
        minimumDate={values.startDate || undefined}
      />
      <FormField
        label="Description"
        value={values.description}
        onChangeText={(value) => onChange('description', value)}
        error={errors.description}
        placeholder="Optional notes for the group"
        multiline
      />
    </>
  );
}
