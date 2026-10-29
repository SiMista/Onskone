import { Router, Request, Response } from 'express';
import { getMaintenance } from '../utils/maintenance.js';

const router: Router = Router();

// Public (sans auth) : le client le sonde pour savoir quand la maintenance est levée
// sans dépendre d'une socket, et l'admin n'a rien de sensible à y cacher.
router.get('/maintenance', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getMaintenance());
});

export default router;
