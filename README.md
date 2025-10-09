## MyPantry (Expo + SQLite)

Track canned pantry items with QR labels, camera scan to mark used, and backup/restore to JSON.

### Features
- Item types with recipe and notes
- Jars per item type, add and mark used
- Generate QR code labels for jars
- Scan QR to mark jar used
- Backup database to JSON and restore from JSON

### Getting Started
1. Install deps:
   - `npm install`
2. Run the app:
   - Android: `npm run android`
   - Web: `npm run web` (camera APIs are limited in some browsers)

> iOS builds require macOS. You can still develop using Expo Go on a physical iOS device.

### App Structure
- `src/db.ts`: SQLite schema and helpers (item types, jars, import/export, QR payload helpers)
- `src/App.tsx`: Navigation (tabs + stack)
- `src/screens/HomeScreen.tsx`: List item types, navigate to detail or add
- `src/screens/ItemTypeFormScreen.tsx`: Create/edit type with recipe and notes
- `src/screens/ItemDetailScreen.tsx`: Manage jars, generate labels, mark used
- `src/screens/QRLabelScreen.tsx`: Render QR for a given jar
- `src/screens/QRScannerScreen.tsx`: Scan and mark jar as used
- `src/screens/BackupRestoreScreen.tsx`: Backup to JSON, restore from JSON

### Backup / Restore
- Backup: Tab "Backup" → "Backup to JSON". Share or save the file.
- Restore: Tab "Backup" → "Restore from JSON". Choose a previously exported JSON file.

### QR Codes
- Each jar label encodes `{ type: 'mypantry-jar', id: <jarId> }` as JSON.
- Scanning a label marks the jar as used.

### Notes
- Camera permission is requested before scanning.
- Data persists locally in `expo-sqlite` (`mypantry.db`).


