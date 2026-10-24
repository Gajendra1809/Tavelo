import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/** Notifications and old links land on the trip Chat tab. */
export default function TripChatRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  return <Redirect href={`/trip/${id}?tab=chat` as Href} />;
}
