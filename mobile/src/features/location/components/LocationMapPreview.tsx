import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { openMapsDirections } from '@/features/location/openInMaps';
import { buildOsmMapPreviewHtml } from '@/features/location/osmMapPreviewHtml';
import type { TaveloPlace } from '@/features/location/types';
import { hasVerifiedCoordinates } from '@/features/location/types';
import { colors, radius, spacing, typography } from '@/theme';

const PREVIEW_HEIGHT = 168;

type LocationMapPreviewProps = {
  place: TaveloPlace;
};

export function LocationMapPreview({ place }: LocationMapPreviewProps) {
  const [mapFailed, setMapFailed] = useState(false);
  const hasCoords = hasVerifiedCoordinates(place);

  if (!hasCoords) {
    return (
      <View style={[styles.frame, styles.placeholder]}>
        <SymbolView
          name={{ android: 'location_on', web: 'location_on' }}
          size={32}
          tintColor={colors.muted}
        />
        <Text style={styles.coordsMuted}>Map preview appears when you pick a place from search.</Text>
      </View>
    );
  }

  const lat = place.latitude!;
  const lng = place.longitude!;
  const html = buildOsmMapPreviewHtml(lat, lng);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open this location in Google Maps"
        onPress={() => void openMapsDirections(place)}
        style={({ pressed }) => [styles.frame, pressed ? styles.pressed : null]}
      >
        {mapFailed ? (
          <View style={[styles.placeholder, styles.frameInner]}>
            <Text style={styles.coordsMuted}>Could not load map tiles.</Text>
            <Text style={styles.coords}>
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </Text>
          </View>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={styles.webview}
            scrollEnabled={false}
            pointerEvents="none"
            javaScriptEnabled
            domStorageEnabled={false}
            cacheEnabled
            onError={() => setMapFailed(true)}
            onHttpError={() => setMapFailed(true)}
            {...(Platform.OS === 'android' ? { androidLayerType: 'hardware' as const } : {})}
          />
        )}
        <View style={styles.openHint} pointerEvents="none">
          <SymbolView
            name={{ android: 'open_in_new', web: 'open_in_new' }}
            size={14}
            tintColor={colors.primary}
          />
          <Text style={styles.openHintText}>Tap to open in Google Maps</Text>
        </View>
      </Pressable>
      <Text style={styles.attribution}>
        Map © OpenStreetMap — directions use Google Maps (no in-app API key).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  frame: {
    height: PREVIEW_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    backgroundColor: colors.seafoam,
  },
  frameInner: {
    height: PREVIEW_HEIGHT,
  },
  pressed: {
    opacity: 0.92,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.seafoam,
  },
  webview: {
    height: PREVIEW_HEIGHT,
    width: '100%',
    backgroundColor: colors.seafoam,
  },
  openHint: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
  },
  openHintText: {
    ...typography.label,
    fontSize: 11,
    color: colors.primary,
  },
  attribution: {
    ...typography.label,
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
  },
  coords: {
    ...typography.body,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  coordsMuted: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
});
