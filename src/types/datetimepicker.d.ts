declare module '@react-native-community/datetimepicker' {
  import type { ComponentType } from 'react';

  export type DateTimePickerEvent = {
    type: 'set' | 'dismissed' | string;
    nativeEvent: unknown;
  };

  export type DateTimePickerProps = {
    value: Date;
    mode?: 'date' | 'time' | 'datetime' | 'countdown';
    display?: 'default' | 'spinner' | 'calendar' | 'clock' | 'compact' | 'inline';
    maximumDate?: Date;
    minimumDate?: Date;
    themeVariant?: 'light' | 'dark';
    textColor?: string;
    accentColor?: string;
    locale?: string;
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
    style?: unknown;
  };

  const DateTimePicker: ComponentType<DateTimePickerProps>;
  export default DateTimePicker;
}
