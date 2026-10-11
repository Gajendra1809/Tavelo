import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type BookingAttachmentSource = 'gallery' | 'document';

/** Ask how to attach: gallery works reliably for photos on Android; document picker for PDFs. */
export function promptBookingAttachmentSource(): Promise<BookingAttachmentSource | null> {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo library', 'PDF or file'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) {
            resolve('gallery');
          } else if (index === 2) {
            resolve('document');
          } else {
            resolve(null);
          }
        },
      );
    });
  }

  return new Promise((resolve) => {
    Alert.alert('Attach file', 'Choose where to pick your attachment.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      { text: 'Photo library', onPress: () => resolve('gallery') },
      { text: 'PDF or file', onPress: () => resolve('document') },
    ]);
  });
}
