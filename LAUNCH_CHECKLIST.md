# Pre-Launch Security & Deployment Checklist

## 🔴 Critical (Must Complete Before Launch)

### Security & Authentication
- [x] **Environment Configuration**
  - [x] Created `.env.example` with all required variables
  - [x] Implemented environment validation with Zod in `config.ts`
  - [ ] Generate strong JWT secrets (min 32 characters)
  - [ ] Set appropriate values for production in Secret Manager

- [x] **Security Headers**
  - [x] Implemented Helmet.js for security headers
  - [x] Added CSP (Content Security Policy)
  - [x] Enabled HSTS (HTTP Strict Transport Security)
  - [x] Added HTTPS redirect middleware

- [x] **Rate Limiting**
  - [x] Implemented express-rate-limit
  - [x] Applied general API limiter (100 req/15 min)
  - [x] Applied stricter auth limiter (5 req/15 min)
  - [x] Applied AI limiter (20 req/5 min)
  - [ ] Monitor and adjust limits based on usage

- [x] **Input Validation**
  - [x] Implemented Zod schemas for all inputs
  - [x] Created validation middleware
  - [x] Added request body validation
  - [ ] Apply to ALL existing routes

- [x] **JWT & Refresh Tokens**
  - [x] Implemented access/refresh token separation
  - [x] Added token rotation logic
  - [x] Created `/auth/refresh` endpoint
  - [ ] Implement token blacklist in Redis for logout (optional)
  - [ ] Add token expiry monitoring

- [x] **Firestore Security**
  - [x] Created comprehensive security rules
  - [x] Configured role-based access control
  - [x] Set up document-level authorization
  - [ ] Deploy rules via Firebase CLI: `firebase deploy --only firestore:rules`
  - [ ] Never use Test Mode in production

### Error Handling & Logging
- [x] **Centralized Error Handling**
  - [x] Custom error classes (AppError, ValidationError, etc.)
  - [x] Global error handler middleware
  - [x] Proper HTTP status codes
  - [x] Structured error responses

- [x] **Request Logging**
  - [x] Integrated Winston logger
  - [x] Added Morgan HTTP logging
  - [x] Created correlation ID middleware
  - [ ] Setup log rotation: Create `/logs` directory
  - [ ] Monitor logs for errors in production

- [x] **React Error Boundary**
  - [x] Created global error boundary component
  - [x] Graceful error UI
  - [ ] Wrap entire app with ErrorBoundary in App.tsx
  - [ ] Integrate with error tracking service

### Secrets Management
- [x] **Git & Secrets**
  - [x] Updated .gitignore with sensitive files
  - [x] Marked serviceAccountKey.json as ignored
  - [ ] Use Firebase Secret Manager for secrets in production
  - [ ] Never commit .env files
  - [ ] Setup pre-commit hooks to scan for secrets (optional)

---

## 🟠 High Priority (Week 1-2)

### Testing
- [ ] **Backend Unit Tests**
  - [ ] Setup Jest/Vitest (currently have tsx only)
  - [ ] Test auth middleware
  - [ ] Test error handling
  - [ ] Test validation schemas
  - [ ] Aim for 80%+ coverage on critical paths

- [ ] **ML Service Tests**
  - [ ] Setup pytest for Python
  - [ ] Test recommendation engine
  - [ ] Test scheduling conflicts
  - [ ] Test edge cases and fallbacks

- [ ] **API Integration Tests**
  - [ ] Setup Supertest
  - [ ] Test complete auth flow (register → login → refresh)
  - [ ] Test patient-doctor relationships
  - [ ] Test session scheduling
  - [ ] Test permission guards

- [ ] **Frontend Component Tests**
  - [ ] Setup Vitest + React Testing Library
  - [ ] Test critical components
  - [ ] Test error boundary
  - [ ] Test auth flow in UI

### Performance
- [ ] **Database Optimization**
  - [ ] Create Firestore composite indexes for:
    - `sessions` (patientId, status, scheduledAt)
    - `sessions` (doctorId, status, scheduledAt)
    - `patients` (assignedDoctorId, createdAt)
  - [ ] Configure in Firebase Console or via `firestore.indexes.json`

- [ ] **Frontend Performance**
  - [ ] Install React Query (TanStack Query): `npm i @tanstack/react-query`
  - [ ] Add query caching for API endpoints
  - [ ] Implement lazy loading for dashboard charts
  - [ ] Add request debouncing for search inputs
  - [ ] Run Lighthouse audit (target: 80+ performance score)

### Observability
- [ ] **Error Tracking (Sentry)**
  - [ ] Create Sentry account and project
  - [ ] Install `@sentry/react` and `@sentry/node`
  - [ ] Initialize Sentry in frontend entry point
  - [ ] Link error boundary to Sentry
  - [ ] Setup alerts for critical errors

- [ ] **Monitoring**
  - [ ] Setup Better Uptime or UptimeRobot
  - [ ] Monitor `/api/health` endpoint
  - [ ] Setup Slack notifications for downtime
  - [ ] Create dashboard for key metrics

---

## 🟡 Medium Priority (Week 3-4)

### UX & Accessibility
- [ ] **Loading States**
  - [ ] Replace spinners with skeleton screens
  - [ ] Implement smooth transitions
  - [ ] Ensure no layout shift during loading

- [ ] **Offline Handling**
  - [ ] Detect WebSocket disconnections
  - [ ] Show offline indicator UI
  - [ ] Queue actions when offline
  - [ ] Sync when connection restored

- [ ] **Form Improvements**
  - [ ] Implement auto-save to localStorage
  - [ ] Warn on unsaved changes
  - [ ] Show validation errors inline
  - [ ] Test cross-browser compatibility

- [ ] **Accessibility (WCAG 2.1 AA)**
  - [ ] Add ARIA labels to interactive elements
  - [ ] Ensure keyboard navigation works everywhere
  - [ ] Test with screen readers
  - [ ] Add focus indicators
  - [ ] Run axe accessibility scanner

- [ ] **Mobile Responsiveness**
  - [ ] Test on mobile devices
  - [ ] Verify Tailwind breakpoints work
  - [ ] Test touch interactions
  - [ ] Ensure forms are mobile-friendly

### Feature Enhancements
- [ ] **Printable/Exportable Reports**
  - [ ] Install `react-pdf`
  - [ ] Create treatment plan PDF export
  - [ ] Add email export option

- [ ] **Notifications**
  - [ ] Email reminders 24h before appointment
  - [ ] SMS reminders (optional: integrate Twilio)
  - [ ] In-app notifications via Socket.io

- [ ] **Patient Features**
  - [ ] Add progress charts for patients
  - [ ] Show treatment timeline
  - [ ] Add session ratings and reviews

### ML Service Hardening
- [ ] **Model Versioning**
  - [ ] Implement version tracking
  - [ ] Use staging for model updates
  - [ ] Never retrain in production without testing

- [ ] **Fallback Logic**
  - [ ] Implement fallback recommendations if ML service down
  - [ ] Cache frequent dosha-therapy mappings
  - [ ] Use Redis for caching (optional)

- [ ] **Input Validation**
  - [ ] Validate patient data before sending to ML
  - [ ] Schema validation before scikit-learn
  - [ ] Handle model errors gracefully

---

## 🟢 Production Infrastructure

### Containerization & Deployment
- [ ] **Docker Setup**
  - [ ] Create Dockerfile for frontend (Node.js)
  - [ ] Create Dockerfile for backend (Node.js)
  - [ ] Create Dockerfile for ML service (Python)
  - [ ] Create docker-compose.yml for local development
  - [ ] Test containers work correctly

- [ ] **Deployment Strategy**
  - [ ] Frontend → Vercel/Netlify or Cloud Storage + CDN
  - [ ] Backend → Railway, Render, Cloud Run, or similar
  - [ ] ML Service → Separate container/Cloud Run
  - [ ] Database → Firebase Firestore (managed)
  - [ ] Email → SendGrid or AWS SES (not Nodemailer in prod)

- [ ] **CI/CD Pipeline**
  - [ ] Setup GitHub Actions workflows
  - [ ] Lint & format checking
  - [ ] Run automated tests
  - [ ] Build Docker images
  - [ ] Deploy on main branch
  - [ ] Staging/preview deployments for PRs

### Database Security & Backup
- [ ] **Firestore Rules**
  - [ ] Deploy rules from `firestore.rules`
  - [ ] Test rules thoroughly
  - [ ] Setup automated backups
  - [ ] Export to Cloud Storage weekly

- [ ] **Data Retention**
  - [ ] Define retention policy for audit logs (e.g., 2 years)
  - [ ] Implement TTL for sensitive data if needed
  - [ ] Document data retention compliance

---

## 📋 Compliance (India - DPDP Act)

For India-based healthcare application:

- [ ] **Data Protection**
  - [ ] DPDP Act compliance documentation
  - [ ] User consent for data processing
  - [ ] Data processing agreement (DPA)

- [ ] **Audit Logging**
  - [ ] Log all data access
  - [ ] Track modifications with timestamps
  - [ ] Store audit logs immutably
  - [ ] Retention: minimum 2 years

- [ ] **Patient Privacy**
  - [ ] Privacy policy
  - [ ] Terms of service
  - [ ] Consent management UI
  - [ ] Right to access/delete data
  - [ ] Data anonymization for analytics

---

## 📦 Pre-Launch Deployment Tasks

### Week Before Launch

1. **Secrets Setup**
   ```bash
   # Generate strong JWT secrets
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Set in production:
   # Firebase Secret Manager or environment configuration
   ```

2. **Database**
   - [ ] Deploy Firestore security rules
   - [ ] Create required composite indexes
   - [ ] Backup database
   - [ ] Test data integrity

3. **Monitoring**
   - [ ] Setup Sentry for all services
   - [ ] Configure uptime monitoring
   - [ ] Setup log aggregation (Cloudflare Logs, etc.)
   - [ ] Create incident response plan

4. **Testing**
   - [ ] Full end-to-end testing in staging
   - [ ] Load testing
   - [ ] Security scanning (OWASP ZAP, Snyk)
   - [ ] Penetration testing (optional)

5. **Documentation**
   - [ ] Deployment runbook
   - [ ] Incident response procedures
   - [ ] API documentation (Swagger/OpenAPI)
   - [ ] Admin guide

---

## 🚀 Launch Checklist

- [ ] All critical items completed
- [ ] All tests passing (80%+ coverage)
- [ ] Monitoring and alerts configured
- [ ] Backup and recovery tested
- [ ] Team trained on operations
- [ ] Incident response plan drafted
- [ ] Communication plan for launch
- [ ] Rollback plan prepared

---

## Post-Launch Monitoring

After launch, monitor:
- Error rates and types
- API response times
- Database query performance
- Security logs for anomalies
- User feedback and bug reports
- Feature usage analytics

---

## Support & Updates

- Regular security updates for dependencies
- Monthly database backups verification
- Quarterly security audit
- Regular monitoring of Firestore usage and costs

---

**Status**: 🟡 In Progress (11/20 critical items completed)
**Last Updated**: April 16, 2026
**Next Review**: Upon completion of all critical items
