import { createElement } from 'react';
import type { TimeFieldProps } from '@/components/pickerFieldTypes';
import { colors, radius, spacing } from '@/theme';

export type { TimeFieldProps } from '@/components/pickerFieldTypes';

export function TimeField({
  label,
  value,
  onChange,
  error,
  placeholder = 'Choose a time',
  allowClear = false,
}: TimeFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, fontFamily: 'inherit' }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: colors.ink }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        {createElement('input', {
          type: 'time',
          value,
          'aria-label': label,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: webInputStyle(Boolean(error)),
        })}
        {allowClear && value
          ? createElement(
              'button',
              {
                type: 'button',
                onClick: () => onChange(''),
                style: {
                  border: 'none',
                  background: 'transparent',
                  color: colors.primary,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                },
              },
              'Clear',
            )
          : null}
      </div>
      {!value ? <span style={{ fontSize: 14, color: colors.muted }}>{placeholder}</span> : null}
      {error ? <span style={{ fontSize: 14, color: colors.danger }}>{error}</span> : null}
    </div>
  );
}

function webInputStyle(invalid: boolean): Record<string, string | number> {
  return {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: invalid ? colors.danger : colors.line,
    backgroundColor: colors.ivory,
    color: colors.ink,
    fontSize: 16,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    fontFamily: 'inherit',
  };
}
