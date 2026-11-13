# Security Specification — Crown & Felt

## 1. Data Invariants
- Every user profile document at `/users/{userId}` must have `uid == request.auth.uid` on creation and immutable `uid`/`createdAt` on updates.
- User PII (`email`) is strictly isolated at `/users/{userId}/private/account` and readable/writable only by `request.auth.uid == userId`.
- Lobbies at `/lobbies/{lobbyId}` must be created by an authenticated, email-verified user with `hostId == request.auth.uid`, valid `gameType` (`poker` or `rummy`), `deckCount` in `[1..4]`, `botCount` in `[0..5]`, and `status == 'waiting'`.
- Terminal state locking: once a lobby reaches `status == 'finished'`, no further updates are permitted.
- Chat messages at `/lobbies/{lobbyId}/messages/{messageId}` require the parent lobby to exist (`exists()` / `get()`) and `senderId == request.auth.uid`, with text length strictly between 1 and 300 characters.

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated write to `/users/u1` -> PERMISSION_DENIED
2. Identity spoofing: creating `/users/u1` with `uid: "other"` -> PERMISSION_DENIED
3. Shadow field injection: creating `/users/u1` with extra `isAdmin: true` -> PERMISSION_DENIED
4. Unverified email write (`email_verified: false`) to `/lobbies/L1` -> PERMISSION_DENIED
5. Reading another user's private PII `/users/other/private/account` -> PERMISSION_DENIED
6. Listing `/users` or `/lobbies` broadly without owner/host filter -> PERMISSION_DENIED
7. Poisoned ID path variable (1KB junk string) on `/lobbies/{longId}` -> PERMISSION_DENIED
8. Out-of-bounds `deckCount: 99` or `botCount: -1` on `/lobbies/L1` -> PERMISSION_DENIED
9. Non-host updating `deckCount` on `/lobbies/L1` -> PERMISSION_DENIED
10. Updating a `status: 'finished'` lobby back to `'waiting'` -> PERMISSION_DENIED
11. Sending a 5000-character chat message in `/lobbies/L1/messages/m1` -> PERMISSION_DENIED
12. Spoofing `senderId` in `/lobbies/L1/messages/m1` -> PERMISSION_DENIED
