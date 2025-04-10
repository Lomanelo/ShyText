# Fixing Google Authentication in iOS Ad Hoc Builds

## Latest Fix for "Access blocked: This app's request is invalid"

We've made the following changes to fix this issue:

1. **Simplified the redirect URI handling**:

   - Using direct native URI scheme `com.rahimrady.myshytext://` for iOS
   - Removed conditional logic that was causing confusion

2. **Updated the auth flow to directly handle ID tokens**:

   - Removed the complex code/token handling that was causing issues
   - Streamlined the authentication process

3. **Removed problematic plugins**:
   - Removed `expo-build-properties` plugin that was causing startup errors

## Google Cloud Console Setup

For your iOS client in Google Cloud Console:

1. **iOS OAuth Client**: Ensure your iOS client has:

   - Bundle ID: `com.rahimrady.myshytext` (must match exactly)
   - Team ID: Your Apple Developer Team ID (can be left blank for testing)

2. **Web OAuth Client**:
   - Don't use this for iOS apps - you should only use the iOS client

## App Configuration

Your app now has:

- Scheme: `com.rahimrady.myshytext`
- Redirect URI for iOS: `com.rahimrady.myshytext://`
- iOS Bundle ID: `com.rahimrady.myshytext`

## Testing on Ad Hoc Builds

1. Rebuild your app with:

   ```
   npx eas build --profile preview --platform ios
   ```

2. Install the new build on your device

3. When signing in with Google, the app should:
   - Use the proper client ID based on platform
   - Direct to the native OAuth flow
   - Return to your app after authentication

## Debugging Tip

To see what's happening during authentication, check the logs:

- The redirect URI being used
- The platform type
- The app ownership status
- The response parameters

If all else fails, the email authentication option remains available as a reliable testing fallback.
