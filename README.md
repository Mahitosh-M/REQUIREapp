# REQUIREapp

An internal two-shop product requirement workflow built with React, TypeScript, Vite, Firebase Authentication, and Cloud Firestore. It tracks active requirements only; it does not calculate inventory, accounting, or purchase quantities.

## Local development

```powershell
npm install
npm run dev
```

Optional local Firebase emulators:

```powershell
$env:VITE_USE_FIREBASE_EMULATORS="true"
npx -y firebase-tools@latest emulators:start --only auth,firestore
npm run dev
```

## Verification

```powershell
npm test
npm run test:rules
npm run lint
npm run typecheck
npm run build
```

## Firebase setup

The configured Firebase project is `requireapp-b74b3`.

1. Create a Standard edition Firestore database in the Firebase Console. Choose the production region carefully; it cannot be changed later.
2. Enable Email/Password in Authentication > Sign-in method.
3. Create the first Admin account in Authentication.
4. In Firestore, create `users/{AUTH_UID}` with the fields below. Console writes are used only for this first bootstrap profile.

```text
uid: "<AUTH_UID>"
email: "<ADMIN_EMAIL>"
name: "Administrator"
role: "admin"
shopId: null
active: true
createdAt: <timestamp>
updatedAt: <timestamp>
```

5. Deploy indexes, rules, and Hosting after reviewing the rules:

```powershell
npm run build
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes,hosting
```

The Admin Users page creates subsequent Email/Password accounts and protected Firestore profiles without signing out the current Admin.

## Firestore model

- `users`: protected role, fixed Staff shop, and active access state.
- `companies`: Admin-controlled catalogue companies.
- `products`: company-scoped catalogue entries. Staff-created products start as `pending` but are immediately usable.
- `requirements`: active operational records only. IDs are deterministic as `{SHOP_ID}_{productId}`, preventing duplicate active requirements for one shop/product.
- `shops`: optional read-only shop metadata; the app has built-in labels for `SHOP_A` and `SHOP_B`.

Requirements move through `required -> to_send -> incoming`, or `to_send -> required`. Receipt deletes the active requirement. Product names and company fields are not copied into requirement documents, so Admin catalogue corrections appear everywhere without fan-out writes.

## Read strategy

- Active requirement pages use one focused listener each.
- Company lists load once after sign-in.
- Products load only for the selected company and remain cached for the session.
- Product review and user management use one-time Admin reads.
- No completed-history listener or duplicated catalogue snapshots are stored.
