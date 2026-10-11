/** Bundled placeholders until profile and trip cover uploads ship. */
export const images = {
  authRoad: require('../../assets/images/auth-road.jpg'),
  defaultAvatar: require('../../assets/images/default-avatar.jpg'),
  defaultTripCover: require('../../assets/images/default-trip-cover.jpg'),
  emptyTravel: require('../../assets/images/empty-travel.jpg'),
} as const;

export type IllustrationKey = 'travel';

export function illustrationSource(key: IllustrationKey) {
  switch (key) {
    case 'travel':
      return images.emptyTravel;
    default:
      return images.emptyTravel;
  }
}
