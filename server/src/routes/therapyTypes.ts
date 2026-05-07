import { Router, Request, Response } from 'express';
import db, { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const snap = await collections.therapyTypes()
.get();
  const types = queryToArray(snap).filter((t: any) => t.is_active === 1).sort((a: any, b: any) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  res.json(types);
});

router.get('/:id', async (req: Request, res: Response) => {
  const doc = await collections.therapyTypes().doc(req.params.id as string).get();
  const type = docToObj(doc);
  if (!type) return res.status(404).json({ error: 'Therapy type not found' });
  res.json(type);
});

router.post('/', async (req: Request, res: Response) => {
  const {
    name, category, description, duration_minutes,
    pre_procedure_instructions, post_procedure_instructions, contraindications
  } = req.body;

  if (!name || !category || !duration_minutes) {
    return res.status(400).json({ error: 'Name, category, and duration are required' });
  }

  const id = uuidv4();
  await collections.therapyTypes().doc(id).set({
    name, category, description: description || null, duration_minutes,
    pre_procedure_instructions: pre_procedure_instructions || null,
    post_procedure_instructions: post_procedure_instructions || null,
    contraindications: contraindications || null,
    is_active: 1,
  });

  const type = docToObj(await collections.therapyTypes().doc(id).get());
  res.status(201).json(type);
});

router.put('/:id', async (req: Request, res: Response) => {
  const {
    name, category, description, duration_minutes,
    pre_procedure_instructions, post_procedure_instructions, contraindications, is_active
  } = req.body;

  const doc = await collections.therapyTypes().doc(req.params.id as string).get();
  if (!doc.exists) return res.status(404).json({ error: 'Therapy type not found' });

  await collections.therapyTypes().doc(req.params.id as string).update({
    name, category, description, duration_minutes,
    pre_procedure_instructions, post_procedure_instructions,
    contraindications, is_active: is_active ?? 1,
  });

  const type = docToObj(await collections.therapyTypes().doc(req.params.id as string).get());
  res.json(type);
});

export default router;
