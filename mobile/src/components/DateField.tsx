import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { IosPickerSheet } from '@/components/IosPickerSheet';
import { PickerTrigger } from '@/components/PickerTrigger';
import type { DateFieldProps } from '@/components/pickerFieldTypes';
import { formatDateInput, formatDisplayDate, parseDateInput } from '@/lib/dates';

export type { DateFieldProps } from '@/components/pickerFieldTypes';

export function DateField({
  label,
  value,
  onChange,
  error,
  minimumDate,
  maximumDate,
  placeholder = 'Choose a date',
  allowClear = false,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() => (value ? parseDateInput(value) : new Date()));

  useEffect(() => {
    if (open && Platform.OS === 'ios') {
      setIosDraft(value ? parseDateInput(value) : new Date());
    }
  }, [open, value]);

  useEffect(() => () => setOpen(false), []);

  const minDate = minimumDate ? parseDateInput(minimumDate) : undefined;
  const maxDate = maximumDate ? parseDateInput(maximumDate) : undefined;

  return (
    <>
      <PickerTrigger
        label={label}
        displayValue={value ? formatDisplayDate(value) : null}
        placeholder={placeholder}
        error={error}
        onPress={() => setOpen(true)}
        icon="calendar"
        onClear={allowClear && value ? () => onChange('') : undefined}
      />
      {Platform.OS === 'ios' ? (
        <IosPickerSheet
          visible={open}
          title={label}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            onChange(formatDateInput(iosDraft));
            setOpen(false);
          }}
        >
          <DateTimePicker
            value={iosDraft}
            mode="date"
            display="spinner"
            minimumDate={minDate}
            maximumDate={maxDate}
            onValueChange={(_event, date) => setIosDraft(date)}
            themeVariant="light"
          />
        </IosPickerSheet>
      ) : null}
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={value ? parseDateInput(value) : new Date()}
          mode="date"
          display="default"
          minimumDate={minDate}
          maximumDate={maxDate}
          onValueChange={(_event, date) => {
            onChange(formatDateInput(date));
            setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
