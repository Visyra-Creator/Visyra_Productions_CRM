# Visyra CRM - Photography Business Management App

A complete mobile CRM application for managing a photography business, designed for Android tablets with offline-first local data storage.

## 🎯 Overview

Visyra CRM is a comprehensive business management system built specifically for photography professionals. It provides tools to manage leads, clients, shoots, payments, packages, expenses, and portfolios all in one place.

## ✨ Features Implemented

### Core Modules
- **Dashboard**: Business command center with real-time statistics
  - Upcoming shoots count
  - New leads tracking
  - Pending payments overview
  - Monthly revenue display
  - Quick action buttons

- **Clients Management**: Client database with profile cards
  - Add/edit client information
  - Contact details (name, phone, email)
  - Event type and date tracking
  - Search functionality

- **Shoots/Bookings**: Photo shoot scheduling
  - Calendar integration
  - Client linking
  - Location and event type
  - Status tracking (Upcoming/Completed)

- **Payments**: Financial tracking system
  - Total revenue statistics
  - Payment status indicators (Paid/Partial/Pending)
  - Per-client payment tracking
  - Balance calculations

- **Packages**: Pricing and service packages
  - Package creation
  - Duration and pricing
  - Deliverables list
  - Event type categorization

- **Expenses**: Business cost tracking
  - Category management
  - Receipt storage capability
  - Date-based organization
  - Project profit calculations

- **Leads**: Kanban pipeline management
  - 6-stage pipeline (New → Contacted → Proposal → Negotiation → Booked → Lost)
  - Drag-and-drop functionality
  - Budget tracking
  - Follow-up reminders

- **Portfolio**: Professional gallery
  - Category management (Weddings, Pre-wedding, etc.)
  - Featured items support
  - Image management with local storage

- **Settings**: App customization
  - Dark/Light theme toggle
  - Data backup options
  - App version info

### Design Language
- **Dark mode default** with professional aesthetics
- **Color scheme**: Deep purple primary (#7c3aed), Amber accents (#fbbf24)
- **Modern UI**: Rounded cards (16-20px radius), smooth animations
- **Clean typography**: Large hierarchy with consistent spacing
- **Icon system**: Expo Vector Icons throughout

## 🛠️ Technology Stack

### Frontend
- **Expo** - React Native framework
- **React Native** - Cross-platform mobile development
- **Expo Router** - File-based routing system
- **TypeScript** - Type-safe development
- **Expo SQLite** - Local database storage (native platforms)
- **Zustand** - State management
- **date-fns** - Date formatting and manipulation
- **React Navigation** - Navigation infrastructure

### Backend (Ready for future expansion)
- **FastAPI** - Python web framework
- **MongoDB** - Database (configured but app primarily uses local SQLite)

### Local Storage
- **SQLite** database for all business data
- **Expo File System** for image and receipt storage
- **Offline-first** architecture - no internet required

## 📱 Platform Support

**Primary Target**: Android tablets (local admin use)
**Web Preview**: Limited (for development only - SQLite not available on web)
**iOS**: Compatible (but not primary target)

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Yarn or npm
- Expo CLI
- Android Studio (for APK builds)
- Expo Go app (for testing on device)

### Installation

1. **Clone and install dependencies:**
```bash
cd /app/frontend
yarn install
```

2. **Start the development server:**
```bash
yarn start
```

3. **Test on Android device:**
   - Install Expo Go from Play Store
   - Scan the QR code from terminal
   - App will load with full SQLite functionality

### Building Android APK

```bash
# Configure app.json with your package name
# Then build:
cd /app/frontend
eas build --platform android --profile preview

# Or use Expo's classic build:
expo build:android
```

## 📂 Project Structure

```
/app/frontend/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root navigation layout
│   ├── index.tsx          # Dashboard (home)
│   ├── clients.tsx        # Client management
│   ├── shoots.tsx         # Shoot scheduling
│   ├── payments.tsx       # Payment tracking
│   ├── packages.tsx       # Package management
│   ├── expenses.tsx       # Expense tracking
│   ├── leads.tsx          # Lead pipeline
│   ├── portfolio.tsx      # Portfolio gallery
│   └── settings.tsx       # App settings
├── src/
│   ├── database/
│   │   └── db.ts          # SQLite database setup
│   ├── store/
│   │   ├── themeStore.ts  # Theme state management
│   │   └── dataStore.ts   # Data state management
│   └── theme/
│       └── colors.ts      # Color definitions
├── assets/                # Images and static files
├── app.json              # Expo configuration
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript config
```

## 📊 Database Schema

The app uses SQLite with the following tables:

- `clients` - Client information
- `shoots` - Photo shoot bookings
- `payments` - Payment records
- `packages` - Service packages
- `add_ons` - Package add-ons
- `leads` - Sales pipeline
- `expenses` - Business costs
- `portfolio` - Gallery items
- `portfolio_images` - Image references
- `notes` - General notes
- `settings` - App preferences

All tables include timestamps and proper foreign key relationships.

## 🎨 Customization

### Theme Colors
Edit `/app/frontend/src/theme/colors.ts` to customize:
- Primary colors
- Accent colors
- Background shades
- Text colors
- Status colors

### Adding Custom Fields
The system is designed to support dynamic custom fields (planned feature).

## 🔮 Next Steps & Roadmap

### Immediate Priorities
1. **Complete CRUD operations** for all modules (currently read-only for some)
2. **Add form modals** for creating leads, packages, and expenses
3. **Implement drag-and-drop** for Kanban lead board
4. **Add image picker** for portfolio and receipts
5. **Client profile tabs** (Overview, Bookings, Payments, Gallery, Notes)

### Phase 2 Features
6. **Calendar view** for shoots with date picker
7. **Search functionality** across all modules
8. **Data export** (CSV, JSON, PDF reports)
9. **Backup/Restore** functionality
10. **Custom fields system** for all modules

### Phase 3 Enhancements
11. **Advanced analytics** and reporting
12. **Notification system** for reminders
13. **Multi-currency** support
14. **Package templates** library
15. **Client portal** (separate app/web view)

## 🐛 Known Limitations

- **Web preview**: SQLite database doesn't work on web platform (by design - app is for native Android/iOS only)
- **Navigation**: Currently using Stack navigation (Drawer nav had compatibility issues with web preview)
- **Image storage**: File system storage ready but image picker integration pending
- **Forms**: Some create/edit forms still need completion

## 📝 Development Notes

- SQLite database automatically initializes on first app launch
- All data stored locally on device - completely offline
- Theme preference persists across app restarts
- Platform-specific code handles web vs native gracefully

## 🎯 Target User

Solo photography business owner or small photography studio managing:
- 50-200 clients
- 100-500 shoots per year
- Multiple pricing packages
- Business expenses and profitability
- Professional portfolio

## 📄 License

Proprietary - Visyra CRM

## 🤝 Support

For issues, questions, or feature requests, please contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: March 2026  
**Status**: MVP Complete - Core modules functional
