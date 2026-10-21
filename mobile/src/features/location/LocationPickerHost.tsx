import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { InteractionManager } from 'react-native';
import { LocationPickerSheet } from '@/features/location/components/LocationPickerSheet';
import type { TaveloPlace } from '@/types/place';

export type OpenLocationPickerOptions = {
  initialPlace?: TaveloPlace | null;
  allowClear?: boolean;
  onConfirm: (place: TaveloPlace | null) => void;
  /** Called when the sheet is dismissed without confirming. */
  onDismiss?: () => void;
  /** Called when the modal has finished presenting (clears loading on the trigger). */
  onPresented?: () => void;
};

type LocationPickerContextValue = {
  openLocationPicker: (options: OpenLocationPickerOptions) => void;
};

const LocationPickerContext = createContext<LocationPickerContextValue | null>(null);

type HostState = {
  visible: boolean;
  sessionKey: number;
  options: OpenLocationPickerOptions | null;
};

export function LocationPickerProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HostState>({
    visible: false,
    sessionKey: 0,
    options: null,
  });
  const close = useCallback(() => {
    setHost((current) => {
      current.options?.onDismiss?.();
      return { ...current, visible: false, options: null };
    });
  }, []);

  const openLocationPicker = useCallback((options: OpenLocationPickerOptions) => {
    InteractionManager.runAfterInteractions(() => {
      setHost((current) => ({
        visible: true,
        sessionKey: current.sessionKey + 1,
        options,
      }));
    });
  }, []);

  const handleConfirm = useCallback((place: TaveloPlace | null) => {
    setHost((current) => {
      current.options?.onConfirm(place);
      return { ...current, visible: false, options: null };
    });
  }, []);

  const value = useMemo(() => ({ openLocationPicker }), [openLocationPicker]);

  return (
    <LocationPickerContext.Provider value={value}>
      {children}
      <LocationPickerSheet
        visible={host.visible}
        sessionKey={host.sessionKey}
        initialPlace={host.options?.initialPlace}
        allowClear={host.options?.allowClear}
        onClose={close}
        onPresented={host.options?.onPresented}
        onConfirm={handleConfirm}
      />
    </LocationPickerContext.Provider>
  );
}

export function useLocationPicker(): LocationPickerContextValue {
  const ctx = useContext(LocationPickerContext);
  if (!ctx) {
    throw new Error('useLocationPicker must be used within LocationPickerProvider');
  }
  return ctx;
}

/** Lets LocationField show a fallback when the provider is missing (e.g. tests). */
export function useLocationPickerOptional(): LocationPickerContextValue | null {
  return useContext(LocationPickerContext);
}
