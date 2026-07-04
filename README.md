# DevData - Cloud File Storage Platform

A modern full-stack file storage website with **Clerk authentication**, **Google Drive cloud storage**, glassmorphism UI, and dark/light theme.

## Features

- **Upload / Download / Delete** — All file types: PDF, Word, Excel, PPT, ZIP, software, images, video, audio
- **30-Day Restore** — Deleted files go to Trash and can be restored within 30 days
- **Open & Preview** — View PDFs, images, videos, audio, and text files in-browser
- **Original File Names** — Uploaded files keep their exact names
- **Clerk Auth** — Secure user authentication
- **Google Drive** — All data stored in Google Drive cloud
- **Modern UI** — Glassmorphism design with animations and dark/light mode toggle

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Clerk (Authentication)
- Google Drive API (Storage)
- Framer Motion (Animations)
- next-themes (Dark/Light mode)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

### 3. Clerk Setup

1. Create account at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy **Publishable Key** and **Secret Key** to `.env.local`

### 4. Google Drive Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable **Google Drive API**
3. Create a **Service Account** and download JSON key
4. Copy `client_email` → `GOOGLE_CLIENT_EMAIL`
5. Copy `private_key` → `GOOGLE_PRIVATE_KEY` (keep `\n` for line breaks)
6. Create a folder in Google Drive for storage
7. Share that folder with the service account email (Editor access)
8. Copy folder ID from URL → `GOOGLE_DRIVE_FOLDER_ID`

   Folder ID is in URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/files` | List user files |
| POST | `/api/files` | Upload file |
| GET | `/api/files/[id]` | Download/preview file |
| GET | `/api/files/[id]?meta=true` | Get file metadata |
| DELETE | `/api/files/[id]` | Move to trash / permanent delete |
| POST | `/api/files/[id]/restore` | Restore from trash |
| GET | `/api/trash` | List trash files |

## Project Structure

```
src/
├── app/
│   ├── api/files/        # File CRUD APIs
│   ├── api/trash/        # Trash API
│   ├── sign-in/          # Clerk sign in
│   ├── sign-up/          # Clerk sign up
│   └── page.tsx          # Dashboard
├── components/           # UI components
└── lib/
    ├── google-drive.ts   # Google Drive service
    ├── file-types.ts     # File type helpers
    └── constants.ts      # App constants
```

## License

MIT
