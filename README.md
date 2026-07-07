# Ute Run Townsville

UteRun connects people with trusted local ute owners for fast, affordable pickups, deliveries, dump runs, and small moves across Townsville.

## Project Structure

This repository contains multiple applications:

- **Root Next.js Web App** - Data deletion form and management (Deployed on Vercel)
- **frontend/** - React Native Expo mobile app (separate deployment)
- **backend/** - Legacy backend services

## Data Deletion Web App (Next.js)

The root-level Next.js application handles data deletion requests and is deployed on Vercel.

### Features

- Web form for users to request account deletion
- Email integration with nodemailer
- TypeScript support
- Mobile-responsive design

### Data Deletion Request

Users can request deletion of their account and personal data:

1. **Via Web Form**: Visit [https://ute-runtownsville.online/data-deletion/](https://ute-runtownsville.online/data-deletion/)
2. **Via Email**: Send a request to uteruntownsville@gmail.com with your email address or phone number

For more information, see [Data Deletion Policy](./DATA_DELETION_POLICY.md)

## Getting Started

### Next.js Web App (Local Development)

```bash
npm install
npm run dev
```

Open [http://localhost:3000/data-deletion](http://localhost:3000/data-deletion) to view the form.

### Building for Production

```bash
npm run build
npm start
```

### Frontend (Mobile App)

```bash
cd frontend
npm install
npm start
```

### Environment Variables

For email functionality, create a `.env.local` file:

```
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-specific-password
```

## Deployment

The Next.js app is configured for Vercel deployment. Frontend and backend directories are excluded from the build.

## License

This project is private and confidential.
