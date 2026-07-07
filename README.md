# Ute Run Townsville

UteRun connects people with trusted local ute owners for fast, affordable pickups, deliveries, dump runs, and small moves across Townsville.

## Project Structure

This is a monorepo containing the main Ute Run web application built with Expo and expo-router:

- **Root Application** - Expo/React Native web app (deployed on Vercel at https://ute-runtownsville.online)
  - `app/` - App pages and routing (Expo Router)
  - `src/` - Shared components, hooks, context, and utilities
  - `assets/` - Images, fonts, and other assets
  - `package.json` - Main dependencies
  - `app.json` - Expo configuration

- **Data Deletion Service** - Accessible at `/data-deletion` route
  - `pages/api/data-deletion.ts` - API endpoint for deletion requests
  - `pages/data-deletion.tsx` - Web form for users to submit requests

- **Archive Directories** - For reference only
  - `frontend/` - Original Expo project structure
  - `backend/` - Legacy backend services

## Key Features

- 🚗 Connect with local ute owners
- 📱 Easy booking and scheduling
- 💰 Fast and affordable services
- ✅ Trusted and verified users
- 🗑️ Data deletion request form

## Data Deletion

Users can request deletion of their account and personal data:

1. **Via Web Form**: Visit https://ute-runtownsville.online/data-deletion
2. **Via Email**: Send a request to uteruntownsville@gmail.com with your email or phone number

For more information, see [Data Deletion Policy](./DATA_DELETION_POLICY.md)

## Getting Started

### Installation

```bash
npm install
```

### Local Development

```bash
npm run dev
```

This will start the Expo dev server. You can open:
- Web: http://localhost:8081
- iOS/Android: Use Expo Go app to scan QR code

### Building for Production

```bash
npm run build
```

This exports the Expo app as a static web build.

### Environment Variables

Create a `.env.local` file with:

```
EXPO_PUBLIC_API_URL=your_api_url
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
```

## Deployment

The app is deployed on Vercel at https://ute-runtownsville.online

- Push to the `main` branch to trigger automatic deployment
- Vercel builds the Expo web app using `npm run build`
- The web app is served from the root domain
- Data deletion form is available at `/data-deletion`

## Architecture

- **Frontend Framework**: React Native with Expo
- **Routing**: Expo Router (file-based routing)
- **Web Runtime**: React Native Web
- **Authentication**: Custom context-based auth system
- **Data Deletion API**: Node.js with Nodemailer

## License

This project is private and confidential.
