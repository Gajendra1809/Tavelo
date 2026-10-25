# Push notifications

Tavelo keeps every alert in MongoDB first (the in-app inbox). When that row is new, the API also sends a push through the **Expo Push Service**, which delivers Android alerts with **Firebase Cloud Messaging (FCM)**.

The phone cannot send a push to someone else. It can only register or remove **its own** Expo push token. Server credentials never go in the app.

A push is not proof of delivery until you install a new APK on a physical Android phone and receive one. Emulators and Expo Go do not exercise the production FCM credentials.

## What is sent

The same events as the in-app inbox:

| Event | Who is notified |
| --- | --- |
| Trip invitation | The invited person |
| Chat message | Other trip members, at most once per person per trip per hour |
| New poll, poll closed | Other trip members, once per poll and person |
| Booking created, updated, or deleted | Other trip members |
| Expense and settlement changes | The other people involved |

The person who did the action is not notified. Individual poll votes are not notified. A duplicate database row (same idempotency key) does not send a second push.

The push `data` payload includes `notificationId`, `type`, `tripId`, `entityType`, and `entityId`. Tapping the alert opens the same screen as the in-app inbox (invitations, the trip chat tab, a booking, or expenses).

## API

All routes require `Authorization: Bearer <access token>`.

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/api/v1/notifications/devices` | `{ "token": "ExponentPushToken[…]", "platform": "android" }` |
| `DELETE` | `/api/v1/notifications/devices` | `{ "token": "ExponentPushToken[…]" }` |

`POST` saves the token for the signed-in user. The same token can move to another account when that person signs in on the phone. `DELETE` turns the token off for the signed-in user only (used on log out). Expo `DeviceNotRegistered` responses turn a token off automatically.

Optional backend env (see [backend/.env.example](../backend/.env.example)):

| Name | Required | Purpose |
| --- | --- | --- |
| `EXPO_ACCESS_TOKEN` | No | Expo access token sent with push requests. Create one under Expo account settings. Leave unset to use the unauthenticated Expo push endpoint. |

Do not commit this value. On Render, add it under the API service environment if you create one.

## One-time Firebase and Expo setup

Do this before the APK that should receive pushes. Official references:

- [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)

1. In the [Firebase console](https://console.firebase.google.com), create a project (or open the existing one).
2. Add an **Android** app with package name `com.tavelo.app`.
3. Download **`google-services.json`** and save it as `mobile/google-services.json`. This file is a client config. `app.config.ts` picks it up when the file exists. You may commit it. Do **not** commit a Firebase **service account** private key.
4. In Firebase, open **Project settings → Service accounts → Generate new private key**. Store that JSON outside the repo (a password manager or a local folder that is not committed).
5. Upload that key to EAS for FCM V1. From `mobile/`:

   ```powershell
   npx eas-cli credentials
   ```

   Choose **Android → production → Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1) → Upload a new service account key**.

   The preview APK uses the same Android package and the production Android credentials on EAS.

6. Add the private-key file name to `.gitignore` if you ever place it inside the repo. Patterns already ignored: `*firebase-adminsdk*.json` and `service-account*.json`.
7. Redeploy the API if you set `EXPO_ACCESS_TOKEN` on Render. A backend-only change does not require a new APK. Adding `google-services.json` or the notifications plugin **does** require a new APK.

## Phone behavior

- **Profile → Trip alerts** explains the benefit. **Turn on alerts** is what shows the Android permission prompt. The app does not prompt on first launch.
- If Android already allowed alerts, the signed-in app registers the token quietly.
- If permission is denied, Profile offers **Open system settings**.
- Alerts can show while the app is open, in the background, or closed, within Android’s limits (battery restrictions, denied permission, no network).
- **Log out** deactivates this phone’s token, then ends the session.

## Expo Go

Expo Go on Android can open the app. Remote alerts still need the preview APK. Expo Go 57 does not register `ExpoTopicSubscriptionModule`, and importing `expo-notifications` would otherwise crash on launch. `mobile/metro.config.js` loads a safe stand-in for that one module. A rebuilt APK includes the real module.

## Local checks

From `backend/`:

```powershell
npx tsx --test --test-concurrency=1 src/modules/notifications/push.schema.test.ts src/modules/notifications/push.integration.test.ts
```

From `mobile/`:

```powershell
npx tsx --test --test-concurrency=1 src/features/notifications/pushPayload.test.ts
```

These tests do not contact Expo or Firebase. They check token registration, who receives an alert, duplicate suppression, and invalid-token deactivation.

## Build a new Android APK

After `google-services.json` is in `mobile/` and the FCM key is uploaded to EAS:

```powershell
cd mobile
npx eas-cli build -p android --profile preview
```

Install that APK on a **physical** Android phone (not an emulator). Sign in on two accounts, turn on alerts on the second phone, and have the first account invite them or send a chat message. The second phone should show the system alert, and tapping it should open the trip.

If no token is saved, the usual causes are: the APK was built without `google-services.json`, the FCM service-account key is missing on EAS, or notification permission was not granted.
