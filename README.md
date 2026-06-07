# AyurSutra - AI-Powered Therapy Scheduling System for Panchakarma Patient Management

<div align="center">

**ATASS** - AI-Powered Therapy & Smart Scheduling System

A full-stack web application for intelligent management of Panchakarma clinics with AI-driven recommendations, patient portals, and real-time notifications.

[Features](#features) • [Tech Stack](#tech-stack) • [Project Structure](#project-structure) • [Getting Started](#getting-started) • [Overview](#overview)

</div>

---

## Overview

AyurSutra is a comprehensive digital platform designed to modernize Panchakarma clinic management. Panchakarma, the five-fold detoxification therapy system in Ayurveda (Vamana, Virechana, Basti, Nasya, Raktamokshana), requires careful sequencing and personalization. AyurSutra intelligently manages this complexity through:

- **Dual-role portal** for doctors and patients with role-based access control
- **AI-powered therapy recommendations** based on dosha (body constitution) profiles
- **Intelligent scheduling engine** with conflict resolution and optimal timing
- **Real-time notifications** via WebSocket for instant updates
- **Comprehensive analytics dashboard** with treatment insights
- **Patient management** with treatment progress tracking

---

## Features

### 👨‍⚕️ For Doctors & Practitioners

- **Dashboard**: Real-time overview of appointments, patient queue, and therapy distribution
- **Patient Management**: Complete CRUD operations for patient records with dosha profiles
- **Therapy Planning**: AI-recommended treatment plans based on Ayurvedic principles
- **Smart Scheduling**: Automatic conflict-free appointment scheduling with multi-factor optimization
- **Session Tracking**: Record therapy sessions with detailed feedback and outcome metrics
- **Milestone Tracking**: Monitor patient recovery and progress through defined therapy milestones
- **Analytics**: Visual charts for therapy distribution, weekly trends, and clinical insights
- **Real-time Notifications**: Instant updates on appointments and patient status

### 👥 For Patients

- **Doctor Discovery**: Browse and find specialized Panchakarma practitioners
- **Patient Portal**: View assigned therapies and upcoming appointments
- **Appointment Management**: Schedule and manage therapy sessions
- **Progress Tracking**: Monitor treatment progress and recovery milestones
- **Feedback Submission**: Record therapy experiences and health metrics
- **Notifications**: Receive appointment reminders and status updates

### 🤖 AI & ML Features

- **Dosha-Based Personalization**: Algorithm for recommending optimal therapies based on constitution
- **Intelligent Scheduling**: Multi-factor scoring system considering:
  - Therapy-specific optimal timing
  - Dosha-based scheduling preferences
  - Practitioner workload balancing
  - Patient history patterns
- **Feedback Analysis**: Real-time trend analysis and outcome tracking

---

## Tech Stack

### Frontend
- **React 19.2**: Modern UI framework
- **TypeScript 5.9**: Type-safe JavaScript
- **Vite 8.0**: Ultra-fast build tool and dev server
- **Tailwind CSS 4.2**: Utility-first CSS framework
- **React Router DOM 7.13**: Client-side routing
- **Recharts 3.8**: Data visualization and charts
- **Socket.io Client 4.8**: Real-time WebSocket communication
- **Lucide React 1.7**: Icon library

### Backend
- **Node.js 20+**: Server runtime environment
- **Express.js 4.21**: REST API framework
- **TypeScript 5.7**: Type-safe server code
- **Firebase Admin SDK**: Firestore database access
- **JWT (jsonwebtoken)**: Secure authentication
- **Socket.io 4.8**: Real-time bidirectional communication
- **bcryptjs**: Password hashing
- **Nodemailer**: Email notifications
- **UUID**: Unique identifier generation

### Machine Learning Service
- **Python Flask 3.1**: Lightweight ML service framework
- **scikit-learn 1.6**: ML algorithms and utilities
- **NumPy 2.2**: Numerical computing
- **Flask-CORS 5.0**: Cross-Origin Resource Sharing

### Database
- **Firebase Cloud Firestore**: Real-time NoSQL document database
- **Firebase Authentication**: User authentication and management

---

## Project Structure

```
ayursutra/
├── client/                          # React frontend application
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   ├── pages/                  # Page components (Dashboard, Auth, etc.)
│   │   ├── hooks/                  # Custom React hooks (useSocket, etc.)
│   │   ├── api.ts                  # API communication layer
│   │   ├── App.tsx                 # Main app component
│   │   └── main.tsx                # Entry point
│   ├── vite.config.ts              # Vite configuration
│   └── package.json
│
├── server/                          # Express.js backend API
│   ├── src/
│   │   ├── routes/                 # API routes (auth, patients, sessions, etc.)
│   │   ├── models/                 # Database schemas and queries
│   │   ├── middleware/             # Auth and other middleware
│   │   ├── services/               # Business logic (notifications, realtime)
│   │   ├── utils/                  # Utility functions
│   │   ├── index.ts                # Server entry point
│   │   └── seed.ts                 # Database seeding script
│   ├── tsconfig.json
│   └── package.json
│
├── ml-service/                      # Python Flask ML microservice
│   ├── app.py                      # Flask application
│   ├── personalization_engine.py   # Therapy recommendation logic
│   ├── scheduling_engine.py        # Intelligent scheduling system
│   ├── requirements.txt            # Python dependencies
│   └── venv/                       # Virtual environment (after setup)
│
├── FIREBASE_SETUP.md               # Firebase configuration guide
├── SYNOPSIS.md                     # Project documentation and methodology
└── README.md                       # This file
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** - Download from [nodejs.org](https://nodejs.org/)
- **Python 3.9+** - Download from [python.org](https://www.python.org/)
- **Firebase Account** - Create one at [firebase.google.com](https://firebase.google.com/)
- **Git** - For version control

### Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)

2. **Enable Firestore Database**:
   - Navigate to Build → Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" for development
   - Select a region

3. **Generate Service Account Key**:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `server/serviceAccountKey.json`

4. **Add Firebase SDK credentials** for the frontend in your environment

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed Firebase setup instructions.

### Installation

#### 1. Clone the repository

```bash
git clone <repository-url>
cd ayursutra
```

#### 2. Install Server (Backend) Dependencies

```bash
cd server
npm install
cd ..
```

#### 3. Install Client (Frontend) Dependencies

```bash
cd client
npm install
cd ..
```

#### 4. Setup ML Service (Optional but recommended)

```bash
cd ml-service
python -m venv venv

# On macOS/Linux:
source venv/bin/activate

# On Windows:
# venv\Scripts\activate

pip install -r requirements.txt
cd ..
```

---

## Running the Application

### Development Mode

#### Terminal 1 - Backend Server:
```bash
cd server
npm run dev
```
Server runs on `http://localhost:3001`

#### Terminal 2 - Frontend:
```bash
cd client
npm run dev
```
Frontend runs on `http://localhost:5173`

#### Terminal 3 - ML Service (Optional):
```bash
cd ml-service
source venv/bin/activate  # or venv\Scripts\activate on Windows
python app.py
```
ML Service runs on `http://localhost:5000`

### Seeding the Database

Before first use, populate the database with sample data:

```bash
cd server
npm run seed
```

This creates sample doctors, patients, therapy types, and other essential data.

---

## Building for Production

### Frontend Build:
```bash
cd client
npm run build
```
Creates optimized production build in `client/dist/`

### Backend Build:
```bash
cd server
npm run build
npm start
```

---

## API Endpoints

### Authentication Routes
- `POST /api/auth/doctor-register` - Register doctor
- `POST /api/auth/patient-register` - Register patient
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Patient Management
- `GET /api/patients` - Get all patients (doctor's)
- `POST /api/patients` - Create new patient
- `GET /api/patients/:id` - Get patient details
- `PUT /api/patients/:id` - Update patient profile
- `DELETE /api/patients/:id` - Delete patient

### Therapy & Scheduling
- `GET /api/therapies` - Get available therapies
- `POST /api/sessions` - Schedule therapy session
- `GET /api/sessions` - Get sessions
- `GET /api/availability` - Get practitioner availability
- `POST /api/feedback` - Submit session feedback

### Dashboard & Analytics
- `GET /api/dashboard` - Get dashboard data
- `GET /api/notifications` - Get notifications

---

## Project Documentation

- **[SYNOPSIS.md](SYNOPSIS.md)** - Complete project documentation including:
  - Problem formulation and objectives
  - Literature review
  - System architecture overview
  - Detailed methodology and tools
  - Bibliography and references

- **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** - Firebase configuration and setup guide

---

## Key Technologies Explained

### React 19
Modern component-based UI framework with hooks for state management and side effects.

### TypeScript
Adds static typing to JavaScript, catching errors at compile time rather than runtime.

### Vite
Next-generation frontend build tool providing extremely fast development server and optimized production builds.

### Express.js
Minimalist Node.js framework for building REST APIs with middleware support.

### Firebase Firestore
Scalable NoSQL cloud database with real-time synchronization capabilities.

### Socket.io
Real-time bidirectional event-based communication library for WebSocket functionality.

### Flask
Lightweight Python web framework ideal for ML service deployment.

### scikit-learn
Comprehensive Python ML library for implementing personalization and scheduling algorithms.

---

## Database Collections

The application uses 12 Firestore collections:

1. **users** - User accounts (doctors and patients)
2. **doctors** - Doctor profiles and specializations
3. **patients** - Patient records and health profiles
4. **therapy_types** - Available Panchakarma therapies
5. **treatment_plans** - Prescribed therapy sequences for patients
6. **sessions** - Scheduled therapy appointments
7. **feedback** - Session feedback and outcomes
8. **milestones** - Treatment progress milestones
10. **notifications** - Notification records
11. **availability** - Doctor availability slots
12. **availability_templates** - Recurring availability patterns

---

## Features Roadmap

- [ ] SMS notifications
- [ ] Video consultation integration
- [ ] Advanced ML models for outcome prediction
- [ ] Mobile app (React Native)
- [ ] Telemedicine capabilities
- [ ] Integration with health wearables
- [ ] Prescription management system
- [ ] Inventory management for herbs and oils

---

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Change port in vite.config.ts for frontend or server/index.ts for backend
```

**Firebase connection errors:**
- Verify `serviceAccountKey.json` is placed in `server/` directory
- Check Firebase project ID matches configuration

**ML Service not responding:**
- Ensure Python virtual environment is activated
- Verify Flask is running on `localhost:5000`

**WebSocket connection issues:**
- Check CORS configuration in server
- Verify Socket.io client and server versions match

---

## Development Workflow

1. **Frontend Development**: Changes automatically reload via Vite HMR (Hot Module Replacement)
2. **Backend Development**: Use `npm run dev` for automatic restart on file changes
3. **Testing**: Add test files with `.test.ts` or `.spec.ts` extension
4. **Linting**: Run `npm run lint` in client folder to check code quality
5. **Commits**: Include meaningful commit messages describing changes

---

## Contributing

To contribute to AyurSutra:

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and commit: `git commit -m "Add your feature"`
3. Push to branch: `git push origin feature/your-feature`
4. Submit a pull request with detailed description

---

## License

[Add your license information here]

---

## Support & Contact

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact the development team

---

## Acknowledgments

- Built with modern web technologies and best practices
- Inspired by traditional Ayurvedic practices and modern healthcare digitalization
- Thanks to all contributors and the open-source community

---

<div align="center">

Made with ❤️ for better Panchakarma patient management

</div>
