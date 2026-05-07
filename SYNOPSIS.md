# ATAS: AI-Powered Therapy Scheduling System for Panchakarma Patient Management

---

## Contents

1. Introduction
2. Background Details and Literature Review
3. Problem Formulation and Objectives
4. Methodology and Tools to be Used
5. References/Bibliography

---

## 1. Introduction

Ayurveda, one of the oldest holistic healing systems originating in India, continues to serve millions of patients worldwide. Panchakarma, the five-fold detoxification therapy within Ayurveda, involves a structured sequence of treatments such as Vamana (therapeutic emesis), Virechana (purgation), Basti (medicated enema), Nasya (nasal therapy), and Raktamokshana (bloodletting). Despite the growing demand for Ayurvedic treatments, the management of Panchakarma clinics still largely depends on manual record-keeping, paper-based scheduling, and the practitioner's personal experience for therapy selection.

ATASS (AI-Powered Therapy and Smart Scheduling System) is a full-stack web application designed to digitize and intelligently manage Panchakarma patient workflows. The system integrates modern web technologies with machine learning algorithms to provide dual-role access for both doctors and patients, AI-driven therapy recommendations based on Ayurvedic dosha profiles, intelligent scheduling with conflict resolution, real-time notifications, and comprehensive analytics dashboards. The platform enables doctors to manage patient records, schedule therapy sessions, track treatment progress, and receive AI-generated insights, while patients can discover registered practitioners, view their specializations, and manage their appointments through a dedicated patient portal.

The project follows a three-tier architecture comprising a React-based frontend, an Express.js backend with Firebase Cloud Firestore as a NoSQL database, and a Python Flask-based machine learning microservice implementing personalization and scheduling intelligence.

---

## 2. Background Details and Literature Review

### 2.1 Existing Systems and Limitations

Traditional Ayurvedic clinic management relies on paper-based patient records and manual scheduling by receptionists. Generic hospital management systems (HMS) such as OpenMRS and Bahmni cater primarily to modern medicine workflows and lack domain-specific features required for Panchakarma treatments, such as sequential therapy ordering (Purvakarma, Pradhanakarma, Paschatkarma), dosha-based scheduling constraints, and Ayurvedic feedback metrics like digestion rating and energy levels [1].

### 2.2 Web-Based Healthcare Systems

Modern healthcare platforms such as Practo, DocPlanner, and Zocdoc demonstrate the effectiveness of web-based doctor discovery and appointment scheduling [2]. However, these platforms are designed for allopathic medicine and do not accommodate the unique treatment sequences and holistic assessment parameters of Ayurveda. Electronic Health Record (EHR) systems have shown significant improvement in clinical outcomes when combined with decision-support capabilities [3].

### 2.3 AI in Healthcare Scheduling and Recommendations

Machine learning has been applied extensively in healthcare for appointment scheduling optimization, treatment recommendation, and patient outcome prediction. Collaborative filtering and content-based recommendation systems have been used in personalized medicine for drug and treatment selection [4]. Intelligent scheduling systems using multi-factor scoring have demonstrated reduced appointment conflicts and improved resource utilization in clinical settings [5].

### 2.4 Dosha-Based Personalization

The Ayurvedic concept of Prakriti (body constitution) classified into Vata, Pitta, and Kapha doshas forms the basis for treatment personalization in traditional Ayurvedic practice. Recent computational studies have attempted to formalize dosha assessment using machine learning classifiers and have validated the correlation between dosha types and therapy outcomes [6].

### 2.5 Technology Stack Context

React.js has emerged as the dominant frontend framework for building interactive single-page applications [7]. Express.js is a minimalist backend framework for Node.js widely adopted for REST API development. Firebase Cloud Firestore provides a scalable NoSQL document database with real-time synchronization. Flask, a lightweight Python web framework, is commonly used for deploying machine learning models as microservices. scikit-learn is a widely-used Python library for implementing classical machine learning algorithms [8].

---

## 3. Problem Formulation and Objectives

### 3.1 Problem Statement

Panchakarma clinics face significant challenges in managing patient data, scheduling complex multi-session therapy sequences, and personalizing treatment plans based on individual dosha profiles. The absence of integrated digital tools leads to scheduling conflicts, suboptimal therapy selection, poor follow-up tracking, and a lack of data-driven decision support for practitioners.

### 3.2 Objectives

The primary objectives of this project are:

1. **To design and develop a dual-role web application** that provides separate portals for doctors and patients with role-based authentication and access control using JWT (JSON Web Tokens).

2. **To implement an AI-powered therapy recommendation engine** that leverages a dosha-therapy affinity matrix combined with patient feedback analysis to suggest optimal Panchakarma therapies personalized to each patient's constitution and treatment history.

3. **To develop an intelligent scheduling system** that uses multi-factor scoring (therapy-specific optimal timing, dosha-based scheduling preferences, practitioner workload balancing, and patient history patterns) to automatically generate conflict-free therapy schedules.

4. **To build a comprehensive patient management module** with CRUD operations for patient records, treatment plans, therapy sessions, recovery milestones, and session feedback with trend analysis visualization.

5. **To implement real-time communication** using WebSocket (Socket.io) for instant notifications, appointment reminders, and status updates across both doctor and patient interfaces.

6. **To provide an analytics dashboard** with visual charts for therapy distribution, weekly session trends, patient progress metrics, and AI-generated clinical insights.

---

## 4. Methodology and Tools to be Used

### 4.1 System Architecture

The system follows a **microservices-based three-tier architecture**:

- **Presentation Layer (Frontend)**: React 19 single-page application with TypeScript, served via Vite 8 development server with proxy configuration for API routing.
- **Application Layer (Backend)**: Express.js 4 REST API server with TypeScript, handling business logic, authentication, and database operations.
- **Intelligence Layer (ML Service)**: Python Flask microservice hosting the recommendation and scheduling engines.
- **Data Layer**: Firebase Cloud Firestore (NoSQL document database) with 12 collections.

### 4.2 Tools and Technologies

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 19.2 | UI component library |
| | TypeScript | 5.9 | Type-safe JavaScript |
| | Vite | 8.0 | Build tool and dev server |
| | Tailwind CSS | 4.2 | Utility-first CSS framework |
| | React Router DOM | 7.13 | Client-side routing |
| | Recharts | 3.8 | Data visualization and charts |
| | Socket.io Client | 4.8 | Real-time WebSocket communication |
| | Lucide React | 1.7 | Icon library |
| **Backend** | Node.js | 20+ | Server runtime |
| | Express.js | 4.21 | REST API framework |
| | TypeScript | 5.7 | Type-safe server code |
| | Firebase Admin SDK | - | Firestore database access |
| | JSON Web Token (jsonwebtoken) | - | Authentication tokens |
| | bcryptjs | - | Password hashing |
| | Socket.io | - | WebSocket server |
| | uuid | 10.0 | Unique ID generation |
| | tsx | 4.19 | TypeScript execution |
| **ML Service** | Python | 3.x | ML runtime |
| | Flask | 3.1 | REST API microservice |
| | NumPy | 2.2 | Numerical computation |
| | scikit-learn | 1.6 | Machine learning algorithms |
| **Database** | Firebase Cloud Firestore | - | NoSQL document database |
| **Infrastructure** | Firebase (GCP) | - | Cloud platform (asia-south1 region) |

### 4.3 Database Design

Firebase Cloud Firestore is used with the following 12 document collections:

1. **practitioners** — Doctor profiles, credentials, password hashes, verification status
2. **patients** — Patient demographics, dosha profile, medical history, conditions
3. **therapy_types** — Panchakarma therapy catalog with instructions and contraindications
4. **treatment_plans** — Treatment courses linking patients to therapy sequences
5. **therapy_sessions** — Individual session records with status, scores, and timing
6. **patient_feedback** — Post-session ratings (pain, energy, sleep, digestion, overall)
7. **recovery_milestones** — Treatment progress tracking points
8. **notifications** — Multi-channel notification records (in-app, email, SMS)
9. **notification_preferences** — Per-patient notification channel settings
10. **practitioner_availability** — Doctor schedule availability slots
11. **ai_scheduling_log** — Audit trail of AI scheduling decisions
12. **therapy_recommendations** — AI-generated therapy suggestions

### 4.4 Machine Learning Methodology

#### 4.4.1 Therapy Recommendation Engine

The recommendation engine uses a **hybrid approach** combining domain knowledge and feedback-driven learning:

- **Dosha-Therapy Affinity Matrix**: A pre-built knowledge base mapping seven dosha types (Vata, Pitta, Kapha, Vata-Pitta, Pitta-Kapha, Vata-Kapha, Tridosha) to eight Panchakarma therapies with affinity scores ranging from 0.0 to 1.0 based on Ayurvedic principles.
- **Feature Extraction**: Five feedback metrics (overall rating, pain level, energy level, sleep quality, digestion rating) are extracted from patient feedback history. Trend analysis is performed using linear regression via `numpy.polyfit()`, and feedback volatility is calculated using standard deviation.
- **Health Scoring**: A weighted average of normalized metrics produces an overall health score per therapy.
- **Side Effect Detection**: Pattern recognition identifies recurring adverse reactions and applies penalty scores to affected therapies.
- **Confidence Calculation**: Based on the number of data points, ranging from 40% (minimum) to 95% (maximum).

#### 4.4.2 Intelligent Scheduling Engine

The scheduling engine implements a **multi-factor scoring algorithm** (0-100 scale):

- Optimal therapy time alignment (0-25 points): Maps therapies to their Ayurvedically recommended time windows.
- Dosha preference alignment (0-20 points): Considers dosha-specific scheduling rules (e.g., Vata patients require 2-day rest between sessions).
- Practitioner workload balance (0-15 points): Distributes sessions evenly across practitioners.
- Patient history patterns (0-15 points): Learns from past scheduling preferences.
- General time-of-day preference (0-5 points): Weights morning over evening for most therapies.
- **Conflict Resolution**: Automatic detection and avoidance of double-bookings for both practitioners and patients.

### 4.5 Authentication and Security

- **JWT-based authentication** with role claims (`doctor` / `patient`) and 8-hour token expiry.
- **bcrypt password hashing** (10 salt rounds) for secure credential storage.
- **Role-based access control**: Doctor-only endpoints reject patient tokens with HTTP 403; patient-only pages redirect unauthorized users.
- **CORS middleware** configured for cross-origin API access.

### 4.6 Real-Time Communication

- **Socket.io** is used for bidirectional WebSocket communication between the server and connected clients.
- Real-time notifications are pushed for appointment reminders, session status changes, and treatment updates.
- The client uses a custom `useSocket` React hook for managing WebSocket lifecycle.

### 4.7 API Design

The backend exposes **50+ RESTful API endpoints** organized across 12 route modules:

- **Authentication** (6 endpoints): Login, registration, and profile management for both roles.
- **Practitioners** (6 endpoints): CRUD operations and public search for doctor discovery.
- **Patients** (6 endpoints): CRUD with treatment history retrieval.
- **Sessions** (6 endpoints): Session lifecycle with auto-scheduling and conflict detection.
- **AI/ML** (4 endpoints): Slot suggestion, auto-scheduling, therapy recommendation, and insights generation.
- **Additional modules** for treatment plans, therapy types, feedback, milestones, notifications, availability, and dashboard analytics.

### 4.8 Development Methodology

The project is developed using an **Agile iterative approach** with the following phases:

1. **Requirements Analysis**: Identification of Panchakarma-specific workflows and stakeholder needs.
2. **System Design**: Architecture design, database schema definition, and API contract specification.
3. **Implementation**: Parallel development of frontend, backend, and ML service modules.
4. **Integration Testing**: End-to-end testing of data flow across all three tiers.
5. **Deployment**: Cloud deployment on Firebase (Firestore) with local development servers.

---

## 5. References/Bibliography

[1] W. T. L. de Souza, R. M. de Barros, and E. F. de Souza, "Challenges in electronic health records for Ayurvedic medicine: A systematic review," *J. Ayurveda Integr. Med.*, vol. 12, no. 2, pp. 321–328, Apr. 2021.

[2] A. Kvedar, M. Fogel, and E. Elenko, "Digital medicine's march on chronic disease," *Nat. Biotechnol.*, vol. 34, no. 3, pp. 239–246, Mar. 2016.

[3] B. Chaudhry et al., "Systematic review: Impact of health information technology on quality, efficiency, and costs of medical care," *Ann. Intern. Med.*, vol. 144, no. 10, pp. 742–752, May 2006.

[4] G. Dey, A. Mandal, and R. Mukherjee, "Personalized treatment recommendation using machine learning: A systematic review," *Artif. Intell. Med.*, vol. 127, 102281, May 2022.

[5] A. Ahmadi-Javid, Z. Jalali, and K. J. Klassen, "Outpatient appointment systems in healthcare: A review of optimization studies," *Eur. J. Oper. Res.*, vol. 258, no. 1, pp. 3–34, Apr. 2017.

[6] R. Joshi, A. Kulkarni, and S. Phadke, "Computational approaches to Prakriti analysis: Integrating Ayurveda with machine learning," *J. Bioinform. Comput. Biol.*, vol. 19, no. 4, 2150018, Aug. 2021.

[7] A. Banks and E. Porcello, *Learning React: Modern Patterns for Developing React Apps*, 2nd ed. Sebastopol, CA, USA: O'Reilly Media, 2020.

[8] F. Pedregosa et al., "Scikit-learn: Machine learning in Python," *J. Mach. Learn. Res.*, vol. 12, pp. 2825–2830, Oct. 2011.

---

**Signature**

Name of Student: ____________________
Registration Number: ____________________
Department of Computer Science and Engineering
Guru Jambheshwar University of Science and Technology, Hisar

**Signature**

Supervisor: ____________________
Designation: ____________________
Department of Computer Science and Engineering
Guru Jambheshwar University of Science and Technology, Hisar
