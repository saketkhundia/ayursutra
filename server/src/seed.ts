import { initializeDatabase } from './models/database';
import db, { collections } from './models/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

async function seed() {
  initializeDatabase();

  // Clear existing data - delete all docs in each collection
  const collectionNames = [
    'patient_feedback', 'notifications', 'notification_preferences',
    'recovery_milestones', 'therapy_sessions', 'treatment_plans',
    'therapy_types', 'patients', 'practitioners',
  ];

  for (const name of collectionNames) {
    const snap = await db.collection(name).get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  // Practitioners — default password is "doctor123" for all
  const passwordHash = await bcrypt.hash('doctor123', 10);
  const practitioners = [
    { 
      id: uuidv4(), 
      name: 'Dr. Arun Sharma', 
      specialization: 'Panchakarma Specialist', 
      doctor_type: 'Ayurveda',
      experience_years: 15, 
      phone: '+91-9876543210', 
      email: 'dr.arun@atass.com', 
      license_number: 'MCI-2011-48201', 
      verified: true,
      bio: 'Experienced Panchakarma specialist with 15+ years of expertise in detoxification and rejuvenation therapies.',
      qualifications: 'B.A.M.S., M.D. (Panchakarma)',
      // Location
      address: '123 MG Road, AyurVeda Clinic',
      city: 'Bangalore',
      state: 'Karnataka',
      zipcode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
    },
    { 
      id: uuidv4(), 
      name: 'Dr. Priya Nair', 
      specialization: 'Ayurvedic Physician', 
      doctor_type: 'Ayurveda',
      experience_years: 12, 
      phone: '+91-9876543211', 
      email: 'dr.priya@atass.com', 
      license_number: 'MCI-2014-63917', 
      verified: true,
      bio: 'Holistic Ayurvedic physician specializing in chronic disease management and wellness consultations.',
      qualifications: 'B.A.M.S., Diploma in Ayurvedic Pharmacy',
      // Location
      address: '456 Koramangala, Wellness Center',
      city: 'Bangalore',
      state: 'Karnataka',
      zipcode: '560008',
      latitude: 12.9352,
      longitude: 77.6245,
    },
    { 
      id: uuidv4(), 
      name: 'Dr. Rajesh Menon', 
      specialization: 'Detoxification Expert', 
      doctor_type: 'Ayurveda',
      experience_years: 20, 
      phone: '+91-9876543212', 
      email: 'dr.rajesh@atass.com', 
      license_number: 'MCI-2006-29845', 
      verified: true,
      bio: 'Senior detoxification expert with 20+ years of experience in advanced Panchakarma and therapeutic procedures.',
      qualifications: 'B.A.M.S., M.D. (Ayurveda), Advanced Panchakarma Certification',
      // Location
      address: '789 Indiranagar, Health Hub',
      city: 'Bangalore',
      state: 'Karnataka',
      zipcode: '560038',
      latitude: 13.0034,
      longitude: 77.6435,
    },
  ];

  for (const p of practitioners) {
    const { id, ...data } = p;
    await collections.practitioners().doc(id).set({ ...data, password_hash: passwordHash, is_active: 1, is_self_registered: true, created_at: new Date().toISOString() });
  }

  // Therapy Types
  const therapyTypes = [
    {
      id: uuidv4(), name: 'Vamana', category: 'Panchakarma',
      description: 'Therapeutic emesis for Kapha disorders. Removes toxins from the stomach and respiratory tract.',
      duration_minutes: 90,
      pre_procedure_instructions: '1. Follow a light Kapha-aggravating diet for 2-3 days before\n2. Drink warm milk with ghee the night before\n3. Avoid cold foods and heavy meals\n4. Stay well-hydrated\n5. Get adequate rest the night before',
      post_procedure_instructions: '1. Rest for 2-3 hours after the procedure\n2. Drink warm water in small sips\n3. Eat light rice gruel (peya) when hungry\n4. Avoid exposure to cold, wind, and dust\n5. No heavy meals for 24 hours\n6. Avoid suppressing natural urges',
      contraindications: 'Heart disease, pregnancy, children under 12, elderly with weakness'
    },
    {
      id: uuidv4(), name: 'Virechana', category: 'Panchakarma',
      description: 'Therapeutic purgation for Pitta disorders. Cleanses the liver, gallbladder, and small intestine.',
      duration_minutes: 120,
      pre_procedure_instructions: '1. Internal oleation with ghee for 3-7 days\n2. External oleation (Abhyanga) before the procedure\n3. Swedana (steam therapy) before Virechana\n4. Light diet the day before\n5. Avoid cold, heavy, and spicy foods',
      post_procedure_instructions: '1. Complete rest for the day\n2. Start with warm water, then peya (rice gruel)\n3. Gradually progress from liquid to semi-solid to solid diet over 3-5 days\n4. Avoid heavy, fried, and cold foods for a week\n5. Resume normal activities after 3 days\n6. Follow the Samsarjana Krama (graduated diet)',
      contraindications: 'Pregnancy, rectal prolapse, severe debility, bleeding disorders'
    },
    {
      id: uuidv4(), name: 'Basti', category: 'Panchakarma',
      description: 'Medicated enema therapy for Vata disorders. Considered the most important of the five Panchakarma therapies.',
      duration_minutes: 60,
      pre_procedure_instructions: '1. Light meal 3-4 hours before the procedure\n2. Abhyanga and Swedana before Basti\n3. Empty bladder before the procedure\n4. Avoid heavy and gas-forming foods\n5. Stay relaxed and calm',
      post_procedure_instructions: '1. Lie on your back for 15-30 minutes after\n2. Avoid straining or heavy activity\n3. Light warm food when hungry\n4. Drink warm water throughout the day\n5. Avoid cold baths and cold drinks\n6. Rest adequately',
      contraindications: 'Diarrhea, rectal bleeding, severe anemia, intestinal obstruction'
    },
    {
      id: uuidv4(), name: 'Nasya', category: 'Panchakarma',
      description: 'Nasal administration of medicated oils for head, neck, and sinus disorders.',
      duration_minutes: 45,
      pre_procedure_instructions: '1. Facial Abhyanga and steam before the procedure\n2. Clear nasal passages\n3. Avoid eating 1 hour before\n4. Relax and stay warm\n5. Remove contact lenses or glasses',
      post_procedure_instructions: '1. Spit out any medication that drains into the throat\n2. Avoid cold water, cold food, and exposure to wind\n3. Do not blow your nose forcefully\n4. Gargle with warm water\n5. Avoid dust and pollution\n6. Keep the head warm',
      contraindications: 'Acute cold, fever, pregnancy, menstruation, immediately after meals'
    },
    {
      id: uuidv4(), name: 'Raktamokshana', category: 'Panchakarma',
      description: 'Therapeutic bloodletting for blood-related disorders and skin diseases.',
      duration_minutes: 60,
      pre_procedure_instructions: '1. Light meal 2-3 hours before\n2. Stay well hydrated\n3. Avoid blood-thinning medications (consult doctor)\n4. Inform about any bleeding disorders\n5. Rest well the previous night',
      post_procedure_instructions: '1. Apply pressure on the site with sterile gauze\n2. Rest for 1-2 hours\n3. Drink pomegranate juice or iron-rich fluids\n4. Avoid strenuous activity for 24 hours\n5. Keep the area clean and dry\n6. Eat nourishing, easy-to-digest food',
      contraindications: 'Anemia, pregnancy, children, extreme weakness, bleeding disorders'
    },
    {
      id: uuidv4(), name: 'Abhyanga', category: 'Pre-procedure',
      description: 'Full-body warm oil massage to improve circulation and prepare the body for Panchakarma.',
      duration_minutes: 60,
      pre_procedure_instructions: '1. Arrive with empty or light stomach\n2. Remove all jewelry\n3. Inform about skin allergies\n4. Drink warm water before session',
      post_procedure_instructions: '1. Rest for 15-30 minutes\n2. Take a warm bath after 30 minutes\n3. Drink warm water\n4. Avoid cold exposure',
      contraindications: 'Fever, acute inflammation, skin infections'
    },
    {
      id: uuidv4(), name: 'Swedana', category: 'Pre-procedure',
      description: 'Herbal steam therapy to open channels and facilitate detoxification.',
      duration_minutes: 30,
      pre_procedure_instructions: '1. Complete Abhyanga before Swedana\n2. Stay hydrated\n3. Inform about heat sensitivity\n4. Remove metal jewelry',
      post_procedure_instructions: '1. Wipe off sweat gently\n2. Rest in a warm room for 15 minutes\n3. Drink warm water\n4. Avoid cold drafts and cold water',
      contraindications: 'Heart conditions, pregnancy, fever, hypertension'
    },
    {
      id: uuidv4(), name: 'Shirodhara', category: 'Specialty',
      description: 'Continuous stream of warm medicated oil poured on the forehead for stress relief and neurological conditions.',
      duration_minutes: 45,
      pre_procedure_instructions: '1. Light meal 2 hours before\n2. Clear your mind and relax\n3. Remove hair accessories\n4. Inform about headaches or scalp conditions',
      post_procedure_instructions: '1. Rest quietly for 30 minutes\n2. Avoid washing hair for a few hours\n3. Avoid screen time for 2-3 hours\n4. Light warm food\n5. Early to bed recommended',
      contraindications: 'Acute fever, brain tumors, recent neck injuries'
    },
  ];

  for (const t of therapyTypes) {
    const { id, ...data } = t;
    await collections.therapyTypes().doc(id).set({ ...data, is_active: 1, created_at: new Date().toISOString() });
  }

  // Patients — default password is "patient123" for all
  const patientPasswordHash = await bcrypt.hash('patient123', 10);
  const patients = [
    { id: uuidv4(), name: 'Ananya Patel', age: 35, gender: 'Female', phone: '+91-9900112233', email: 'ananya@email.com', address: '45 MG Road, Bangalore', medical_history: 'Chronic sinusitis, mild asthma', prakriti: 'Kapha-Pitta', current_dosha_imbalance: 'Kapha', allergies: 'None' },
    { id: uuidv4(), name: 'Vikram Singh', age: 48, gender: 'Male', phone: '+91-9900112234', email: 'vikram@email.com', address: '12 Lajpat Nagar, Delhi', medical_history: 'Lower back pain, joint stiffness, mild hypertension', prakriti: 'Vata-Pitta', current_dosha_imbalance: 'Vata', allergies: 'Shellfish' },
    { id: uuidv4(), name: 'Meera Krishnan', age: 29, gender: 'Female', phone: '+91-9900112235', email: 'meera@email.com', address: '78 Anna Nagar, Chennai', medical_history: 'Stress, insomnia, acidity', prakriti: 'Pitta', current_dosha_imbalance: 'Pitta', allergies: 'None' },
    { id: uuidv4(), name: 'Ravi Deshmukh', age: 55, gender: 'Male', phone: '+91-9900112236', email: 'ravi@email.com', address: '34 Koregaon Park, Pune', medical_history: 'Type 2 diabetes, obesity, knee pain', prakriti: 'Kapha', current_dosha_imbalance: 'Kapha-Vata', allergies: 'Penicillin' },
    { id: uuidv4(), name: 'Sunita Reddy', age: 42, gender: 'Female', phone: '+91-9900112237', email: 'sunita@email.com', address: '56 Jubilee Hills, Hyderabad', medical_history: 'Migraine, neck pain, irregular menstruation', prakriti: 'Vata', current_dosha_imbalance: 'Vata-Pitta', allergies: 'None' },
  ];

  for (const p of patients) {
    const { id, ...data } = p;
    await collections.patients().doc(id).set({ ...data, password_hash: patientPasswordHash, created_at: new Date().toISOString() });
    await collections.notificationPreferences().doc(uuidv4()).set({
      patient_id: id, in_app: 1, sms: 0, email: 0, push: 0,
      reminder_hours_before: 24, created_at: new Date().toISOString(),
    });
  }

  // Treatment Plans
  const plans = [
    { id: uuidv4(), patient_id: patients[0].id, practitioner_id: practitioners[0].id, diagnosis: 'Kapha accumulation with chronic sinusitis', plan_name: 'Kapha Shodhana Program', start_date: '2026-03-15', end_date: '2026-04-15', status: 'active' },
    { id: uuidv4(), patient_id: patients[1].id, practitioner_id: practitioners[2].id, diagnosis: 'Vata aggravation with musculoskeletal complaints', plan_name: 'Vata Shamana & Basti Program', start_date: '2026-03-20', end_date: '2026-04-20', status: 'active' },
    { id: uuidv4(), patient_id: patients[2].id, practitioner_id: practitioners[1].id, diagnosis: 'Pitta imbalance with stress and insomnia', plan_name: 'Pitta Balancing & Relaxation', start_date: '2026-03-25', end_date: '2026-04-25', status: 'active' },
    { id: uuidv4(), patient_id: patients[3].id, practitioner_id: practitioners[0].id, diagnosis: 'Kapha-Vata imbalance with metabolic issues', plan_name: 'Detox & Rejuvenation Package', start_date: '2026-03-10', end_date: '2026-04-30', status: 'active' },
    { id: uuidv4(), patient_id: patients[4].id, practitioner_id: practitioners[1].id, diagnosis: 'Vata-Pitta imbalance with neurological symptoms', plan_name: 'Nasya & Shirodhara Protocol', start_date: '2026-03-18', end_date: '2026-04-18', status: 'active' },
  ];

  for (const p of plans) {
    const { id, ...data } = p;
    await collections.treatmentPlans().doc(id).set({ ...data, notes: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }

  // Therapy Sessions
  const sessionData: any[] = [];
  const ananyaSessions = [
    { date: '2026-03-16', time: '08:00', therapy: therapyTypes[5], status: 'completed', score: 75 },
    { date: '2026-03-17', time: '08:00', therapy: therapyTypes[6], status: 'completed', score: 78 },
    { date: '2026-03-18', time: '08:00', therapy: therapyTypes[0], status: 'completed', score: 80 },
    { date: '2026-03-25', time: '09:00', therapy: therapyTypes[5], status: 'completed', score: 82 },
    { date: '2026-03-26', time: '09:00', therapy: therapyTypes[3], status: 'completed', score: 85 },
    { date: '2026-04-01', time: '09:00', therapy: therapyTypes[5], status: 'scheduled', score: null },
    { date: '2026-04-02', time: '09:00', therapy: therapyTypes[3], status: 'scheduled', score: null },
    { date: '2026-04-08', time: '09:00', therapy: therapyTypes[3], status: 'scheduled', score: null },
  ];
  for (const s of ananyaSessions) sessionData.push({ id: uuidv4(), plan: plans[0].id, therapy_id: s.therapy.id, patient: patients[0].id, practitioner: practitioners[0].id, date: s.date, time: s.time, status: s.status, score: s.score });

  const vikramSessions = [
    { date: '2026-03-21', time: '10:00', therapy: therapyTypes[5], status: 'completed', score: 70 },
    { date: '2026-03-22', time: '10:00', therapy: therapyTypes[6], status: 'completed', score: 72 },
    { date: '2026-03-23', time: '10:00', therapy: therapyTypes[2], status: 'completed', score: 74 },
    { date: '2026-03-26', time: '10:00', therapy: therapyTypes[2], status: 'completed', score: 78 },
    { date: '2026-03-29', time: '10:00', therapy: therapyTypes[2], status: 'completed', score: 80 },
    { date: '2026-04-01', time: '10:00', therapy: therapyTypes[2], status: 'scheduled', score: null },
    { date: '2026-04-04', time: '10:00', therapy: therapyTypes[2], status: 'scheduled', score: null },
  ];
  for (const s of vikramSessions) sessionData.push({ id: uuidv4(), plan: plans[1].id, therapy_id: s.therapy.id, patient: patients[1].id, practitioner: practitioners[2].id, date: s.date, time: s.time, status: s.status, score: s.score });

  const meeraSessions = [
    { date: '2026-03-26', time: '14:00', therapy: therapyTypes[7], status: 'completed', score: 76 },
    { date: '2026-03-28', time: '14:00', therapy: therapyTypes[7], status: 'completed', score: 80 },
    { date: '2026-03-30', time: '14:00', therapy: therapyTypes[1], status: 'completed', score: 82 },
    { date: '2026-04-02', time: '14:00', therapy: therapyTypes[7], status: 'scheduled', score: null },
    { date: '2026-04-04', time: '14:00', therapy: therapyTypes[7], status: 'scheduled', score: null },
  ];
  for (const s of meeraSessions) sessionData.push({ id: uuidv4(), plan: plans[2].id, therapy_id: s.therapy.id, patient: patients[2].id, practitioner: practitioners[1].id, date: s.date, time: s.time, status: s.status, score: s.score });

  const raviSessions = [
    { date: '2026-03-11', time: '07:00', therapy: therapyTypes[5], status: 'completed', score: 65 },
    { date: '2026-03-12', time: '07:00', therapy: therapyTypes[6], status: 'completed', score: 68 },
    { date: '2026-03-14', time: '07:00', therapy: therapyTypes[1], status: 'completed', score: 70 },
    { date: '2026-03-20', time: '07:00', therapy: therapyTypes[2], status: 'completed', score: 73 },
    { date: '2026-03-25', time: '07:00', therapy: therapyTypes[2], status: 'completed', score: 75 },
    { date: '2026-03-30', time: '07:00', therapy: therapyTypes[2], status: 'completed', score: 78 },
    { date: '2026-04-03', time: '07:00', therapy: therapyTypes[5], status: 'scheduled', score: null },
    { date: '2026-04-05', time: '07:00', therapy: therapyTypes[3], status: 'scheduled', score: null },
  ];
  for (const s of raviSessions) sessionData.push({ id: uuidv4(), plan: plans[3].id, therapy_id: s.therapy.id, patient: patients[3].id, practitioner: practitioners[0].id, date: s.date, time: s.time, status: s.status, score: s.score });

  const sunitaSessions = [
    { date: '2026-03-19', time: '11:00', therapy: therapyTypes[5], status: 'completed', score: 72 },
    { date: '2026-03-20', time: '11:00', therapy: therapyTypes[3], status: 'completed', score: 75 },
    { date: '2026-03-22', time: '11:00', therapy: therapyTypes[7], status: 'completed', score: 78 },
    { date: '2026-03-25', time: '11:00', therapy: therapyTypes[3], status: 'completed', score: 80 },
    { date: '2026-03-28', time: '11:00', therapy: therapyTypes[7], status: 'completed', score: 83 },
    { date: '2026-04-01', time: '11:00', therapy: therapyTypes[3], status: 'scheduled', score: null },
    { date: '2026-04-03', time: '11:00', therapy: therapyTypes[7], status: 'scheduled', score: null },
  ];
  for (const s of sunitaSessions) sessionData.push({ id: uuidv4(), plan: plans[4].id, therapy_id: s.therapy.id, patient: patients[4].id, practitioner: practitioners[1].id, date: s.date, time: s.time, status: s.status, score: s.score });

  const now = new Date().toISOString();
  for (const s of sessionData) {
    await collections.therapySessions().doc(s.id).set({
      treatment_plan_id: s.plan, therapy_type_id: s.therapy_id,
      patient_id: s.patient, practitioner_id: s.practitioner,
      scheduled_date: s.date, scheduled_time: s.time,
      duration_minutes: 60, status: s.status, progress_score: s.score,
      actual_start_time: null, actual_end_time: null, session_notes: null,
      ai_confidence: null, created_at: now, updated_at: now,
    });
  }

  // Patient Feedback
  const completedSessions = sessionData.filter(s => s.status === 'completed');
  for (const s of completedSessions) {
    const baseRating = (s.score || 70) / 20;
    await collections.patientFeedback().doc(uuidv4()).set({
      session_id: s.id, patient_id: s.patient,
      overall_rating: Math.min(5, Math.max(1, Math.round(baseRating))),
      pain_level: Math.max(1, 6 - Math.round(baseRating)),
      energy_level: Math.min(5, Math.round(baseRating + 0.5)),
      sleep_quality: Math.min(5, Math.round(baseRating)),
      digestion_rating: Math.min(5, Math.round(baseRating - 0.3)),
      symptoms_reported: s.score && s.score < 75 ? 'Mild fatigue after session' : 'Feeling better overall',
      improvements: s.score && s.score >= 78 ? 'Improved energy and reduced symptoms' : 'Gradual improvement noticed',
      side_effects: null, additional_notes: null,
      created_at: now,
    });
  }

  // Recovery Milestones
  const milestones = [
    { plan: plans[0].id, patient: patients[0].id, name: 'Complete Purvakarma Preparation', desc: 'Finish pre-treatment oleation and sweating', target: '2026-03-18', achieved: '2026-03-17', status: 'achieved' },
    { plan: plans[0].id, patient: patients[0].id, name: 'Vamana Procedure Complete', desc: 'Successfully complete therapeutic emesis', target: '2026-03-20', achieved: '2026-03-18', status: 'achieved' },
    { plan: plans[0].id, patient: patients[0].id, name: 'Samsarjana Krama Complete', desc: 'Complete graduated diet protocol', target: '2026-03-25', achieved: '2026-03-25', status: 'achieved' },
    { plan: plans[0].id, patient: patients[0].id, name: 'Nasal Clarity Achieved', desc: 'Clear sinuses with Nasya follow-up', target: '2026-04-05', achieved: null, status: 'in-progress' },
    { plan: plans[0].id, patient: patients[0].id, name: 'Full Recovery Assessment', desc: 'Final evaluation and maintenance plan', target: '2026-04-15', achieved: null, status: 'pending' },
    { plan: plans[1].id, patient: patients[1].id, name: 'Initial Body Preparation', desc: 'Complete Abhyanga and Swedana prep', target: '2026-03-23', achieved: '2026-03-22', status: 'achieved' },
    { plan: plans[1].id, patient: patients[1].id, name: '3 Basti Sessions Complete', desc: 'Complete first 3 Basti treatments', target: '2026-03-30', achieved: '2026-03-29', status: 'achieved' },
    { plan: plans[1].id, patient: patients[1].id, name: 'Pain Reduction by 50%', desc: 'Significant improvement in back and joint pain', target: '2026-04-10', achieved: null, status: 'in-progress' },
    { plan: plans[1].id, patient: patients[1].id, name: 'Full Mobility Restoration', desc: 'Regain full range of motion', target: '2026-04-20', achieved: null, status: 'pending' },
    { plan: plans[2].id, patient: patients[2].id, name: 'Stress Level Baseline Established', desc: 'Complete initial assessment', target: '2026-03-27', achieved: '2026-03-26', status: 'achieved' },
    { plan: plans[2].id, patient: patients[2].id, name: 'Improved Sleep Pattern', desc: 'Achieve 7+ hours of quality sleep', target: '2026-04-10', achieved: null, status: 'in-progress' },
    { plan: plans[2].id, patient: patients[2].id, name: 'Pitta Balance Restored', desc: 'Normalized digestion and reduced acidity', target: '2026-04-25', achieved: null, status: 'pending' },
  ];

  for (const m of milestones) {
    await collections.recoveryMilestones().doc(uuidv4()).set({
      treatment_plan_id: m.plan, patient_id: m.patient,
      milestone_name: m.name, description: m.desc,
      target_date: m.target, achieved_date: m.achieved,
      status: m.status, created_at: now,
    });
  }

  // Notifications
  const notifs = [
    { patient: patients[0].id, type: 'reminder', title: 'Upcoming Abhyanga Session', message: 'Your Abhyanga session is scheduled for April 1 at 9:00 AM. Please arrive 15 minutes early.', scheduled_for: '2026-04-01 07:00' },
    { patient: patients[0].id, type: 'pre-procedure', title: 'Pre-procedure: Nasya', message: 'For your upcoming Nasya session: Complete facial Abhyanga, clear nasal passages, avoid eating 1 hour before.', scheduled_for: '2026-04-01 08:00' },
    { patient: patients[1].id, type: 'reminder', title: 'Upcoming Basti Session', message: 'Your Basti session is scheduled for April 1 at 10:00 AM.', scheduled_for: '2026-04-01 08:00' },
    { patient: patients[1].id, type: 'pre-procedure', title: 'Pre-procedure: Basti', message: 'For your Basti: Light meal 3-4 hours before, complete Abhyanga and Swedana, empty bladder before procedure.', scheduled_for: '2026-04-01 06:00' },
    { patient: patients[4].id, type: 'reminder', title: 'Upcoming Nasya Session', message: 'Your Nasya session is scheduled for April 1 at 11:00 AM.', scheduled_for: '2026-04-01 09:00' },
    { patient: patients[2].id, type: 'post-procedure', title: 'Post-procedure: Virechana Recovery', message: 'Continue the Samsarjana Krama diet. Gradually progress to semi-solid foods today.', scheduled_for: '2026-03-31 08:00' },
    { patient: patients[3].id, type: 'milestone', title: 'Milestone Approaching', message: 'You are close to completing your 6th Basti session. Great progress!', scheduled_for: '2026-03-30 10:00' },
  ];

  for (const n of notifs) {
    await collections.notifications().doc(uuidv4()).set({
      patient_id: n.patient, type: n.type, channel: 'in-app',
      title: n.title, message: n.message, scheduled_for: n.scheduled_for,
      is_read: 0, sent_at: null, created_at: now,
    });
  }

  console.log('Database seeded successfully!');
  console.log(`  Practitioners: ${practitioners.length}`);
  console.log(`  Therapy Types: ${therapyTypes.length}`);
  console.log(`  Patients: ${patients.length}`);
  console.log(`  Treatment Plans: ${plans.length}`);
  console.log(`  Therapy Sessions: ${sessionData.length}`);
  console.log(`  Feedback Entries: ${completedSessions.length}`);
  console.log(`  Milestones: ${milestones.length}`);
  console.log(`  Notifications: ${notifs.length}`);
}

// DISABLED: Seed is now run manually with 'npm run seed' if needed
// seed().catch(console.error);
