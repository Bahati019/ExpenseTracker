# Expense Tracker

A personal expense tracker for Android, built for Kenya, where most everyday spending goes through M-Pesa. It reads M-Pesa confirmation SMS messages on your phone, turns them into expenses, and lets you correct the category, set monthly budgets, and see where your money goes. All data stays on your device.

> Not affiliated with or endorsed by Safaricom or M-Pesa.

## Features

- **M-Pesa SMS import (Android)**
  - Scans the SMS inbox on demand with a "Scan & Sync M-Pesa SMS" action
  - Listens for new M-Pesa messages while the app is running
  - Parses Buy Goods / Till, Paybill (including account numbers), Send Money, airtime, and withdrawals
  - Ignores money you receive, since this is an expense tracker
  - Uses the M-Pesa receipt code so the same message is never imported twice
  - Suggests a category from the merchant name; payments it can't classify (most Send Money transfers) land in **Others** for you to review
- **Expenses**: add manually, view a receipt-style detail sheet, edit, and delete (with confirmation)
- **Categories**: Food, Transport, Utilities, Rent & Housing, Entertainment, Others
- **Monthly budgets** per category, with overall progress, a safe daily spend figure, and notifications at 80% and 100% of a budget
- **Dashboard** with total spent, a category pie chart, and a time-of-day greeting
- **CSV export** of your expenses through the system share sheet
- **Dark mode** that follows the phone's system setting
- **Local storage**: expenses, budgets, and profile are saved on the device and reload when the app opens

## Tech stack

| Area | Technology |
|---|---|
| Framework | React Native 0.81, Expo SDK 54 (New Architecture enabled), React 19 |
| Language | TypeScript |
| Navigation | React Navigation 7 (native stack and bottom tabs) |
| State | React Context (`AuthContext`, `ExpenseContext`, `ThemeContext`) |
| Storage | `@react-native-async-storage/async-storage` |
| Charts | `react-native-chart-kit`, `react-native-svg` |
| Notifications | `expo-notifications` |
| Inputs | `@react-native-community/datetimepicker`, `@react-native-picker/picker` |
| SMS | `react-native-get-sms-android`, `react-native-android-sms-listener` |
| Dev build | `expo-dev-client` (a custom build is required, see below) |

There is no backend: no server, database, or cloud sync, and no network requests. Nothing leaves the phone.

### About sign-in

The login and register screens create a **local profile** (name and email) stored on the device, which is used for the greeting. Passwords are collected by the form but are **not validated or stored**, so this is not real authentication and should not be treated as an access control.

## Getting started

### Requirements

- Node.js (LTS) and npm
- JDK 17 or newer
- Android Studio with the Android SDK, NDK, and Platform-Tools
- `ANDROID_HOME` pointing at your SDK folder, with `platform-tools` on your `PATH`
- An Android phone with USB debugging enabled (SMS import needs a real phone that receives M-Pesa messages)

### Run it

```bash
git clone https://github.com/Bahati019/ExpenseTracker.git
cd ExpenseTracker
npm install

# First time, or after adding a native package: build and install the dev client
npx expo run:android

# Day to day
npx expo start --dev-client
```

Open the installed app on your phone. Your phone and computer must be on the same WiFi network for the dev server.

### Important notes

- **Expo Go will not work.** The SMS modules contain native code, so you must use the development build. Don't press `s` in the Expo terminal to switch to Expo Go.
- **The first build is slow**, sometimes close to an hour, because it downloads and compiles everything. Later builds are much faster.
- **Rebuild only when needed.** Run `npx expo run:android` again after adding a native package or changing app icons or native config. TypeScript changes reload through Metro.
- If the Gradle build crashes with "daemon disappeared", your machine is probably short on memory. In `android/gradle.properties`, try `org.gradle.parallel=false`, `org.gradle.workers.max=1`, and `reactNativeArchitectures=arm64-v8a`.

## Permissions

The app requests `READ_SMS` and `RECEIVE_SMS` to detect M-Pesa confirmation messages, and notification permission for budget alerts. Messages are read on the device and are never uploaded.

On recent Android versions, if the Allow button is greyed out for a sideloaded app, go to Settings, Apps, Expense Tracker, the menu, and choose **Allow restricted settings**.

## How M-Pesa import works

1. The app reads SMS messages from the inbox, or receives them live.
2. Messages that look like M-Pesa confirmations go to `utils/mpesaParser.ts`, which extracts the receipt code, amount, merchant or recipient, transaction type, and date.
3. A keyword matcher suggests a category (for example, supermarkets and restaurants map to Food, fuel and rides to Transport, KPLC and airtime to Utilities).
4. Expenses are added with the receipt code as their ID, so repeated scans don't create duplicates.
5. You can edit any expense whose category is wrong.

Send Money messages only contain a name and a phone number, so the app can't know what the payment was for. Those need a manual category.

## Project structure

```
App.tsx
index.ts
app.json
assets/                    icons and splash
context/
  AuthContext.tsx          local profile
  ExpenseContext.tsx       expenses, budgets, persistence, budget notifications
  ThemeContext.tsx
navigation/AppNavigator.tsx
screens/
  LoginScreen.tsx
  RegisterScreen.tsx
  DashboardScreen.tsx      totals, chart, SMS sync and live listener
  ExpensesScreen.tsx       list, receipt view, edit, delete
  BudgetsScreen.tsx
theme/index.ts             colors, categories, formatting helpers
utils/mpesaParser.ts       SMS parsing and category suggestions
android/                   generated native project
```

## Privacy and distribution

- Data is stored locally with AsyncStorage. Uninstalling the app or clearing its data deletes it, and there is no cloud backup. Use the CSV export if you want a copy.
- This app is intended to be **sideloaded for personal use**. Google Play restricts SMS permissions to apps whose core function is messaging, so a Play Store release with these permissions would likely be rejected.
- Never commit real M-Pesa messages (names, phone numbers, and balances) to the repo, including in tests and screenshots.

## Roadmap

- Learn from corrections: remember a recipient's category after you set it once
- A "needs review" state for unclassified Send Money payments
- Weekly and monthly trend views
- App lock with PIN or fingerprint
- Real authentication, if a backend is ever added

## License

`package.json` declares the 0BSD license (the Expo template default). Add a matching `LICENSE` file, or change the license to the one you prefer.
