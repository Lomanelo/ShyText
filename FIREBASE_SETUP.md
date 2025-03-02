# Firebase Setup Instructions

## Firebase Storage Rules

You're experiencing a permission error when trying to upload profile images to Firebase Storage. This is because the default Firebase Storage rules are very restrictive (denying all reads and writes).

### How to Update Firebase Storage Rules

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: "shy-text"
3. In the left sidebar, click on "Storage"
4. Click on the "Rules" tab
5. Replace the existing rules with the following:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile_images/{userId} {
      // Allow read access to anyone
      allow read: if true;

      // Allow write access to authenticated users to their own profile image
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Default deny for all other storage paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

6. Click "Publish" to apply the new rules

These rules will:

- Allow any user to read profile images
- Allow authenticated users to write only to their own profile image path
- Deny all other access by default

### Explanation of the Error

The error "User does not have permission to access 'profile_images/HNpqWRDXKVYr6JlmnXnJu1O4tX13'" occurs because the default Firebase Storage rules deny all writes.

The updated rules allow an authenticated user to write to their own profile image path based on their user ID, which should resolve the permission error.

### Additional Notes

- It may take a few minutes for rule changes to propagate after publishing
- Make sure you're properly authenticated before attempting to upload
- The user ID in the storage path must match the authenticated user's ID
