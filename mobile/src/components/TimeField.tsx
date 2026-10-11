import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { IosPickerSheet } from '@/components/IosPickerSheet';
import { PickerTrigger } from '@/components/PickerTrigger';
import type { TimeFieldProps } from '@/components/pickerFieldTypes';
import {
  defaultTimeDate,
  formatDisplayTime,
  formatTimeInput,
  parseTimeInput,
} from '@/lib/dates';

export type { TimeFieldProps } from '@/components/pickerFieldTypes';

export function TimeField({
  label,
  value,
  onChange,
  error,
  placeholder = 'Choose a time',
  allowClear = false,
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() =>
    value ? parseTimeInput(value) : defaultTimeDate(9, 0),
  );

  useEffect(() => {
    if (open && Platform.OS === 'ios') {
      setIosDraft(value ? parseTimeInput(value) : defaultTimeDate(9, 0));
    }
  }, [open, value]);

  useEffect(() => () => setOpen(false), []);

  return (
    <>
      <PickerTrigger
        label={label}
        displayValue={value ? formatDisplayTime(value) : null}
        placeholder={placeholder}
        error={error}
        onPress={() => setOpen(true)}
        icon="schedule"
        onClear={allowClear && value ? () => onChange('') : undefined}
      />
      {Platform.OS === 'ios' ? (
        <IosPickerSheet
          visible={open}
          title={label}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            onChange(formatTimeInput(iosDraft));
            setOpen(false);
          }}
        >
          <DateTimePicker
            value={iosDraft}
            mode="time"
            display="spinner"
            onValueChange={(_event, date) => setIosDraft(date)}
            themeVariant="light"
          />
        </IosPickerSheet>
      ) : null}
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={value ? parseTimeInput(value) : defaultTimeDate(9, 0)}
          mode="time"
          display="default"
          is24Hour
          onValueChange={(_event, date) => {
            onChange(formatTimeInput(date));
            setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
