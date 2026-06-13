import { Request, Response } from 'express';
import { query } from '../config/database';

export const getPublicSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const [settingsResult, tenantResult] = await Promise.all([
      query(
        `SELECT key, value FROM site_settings WHERE tenant_id = $1 AND key IN ('logo_url', 'site_name')`,
        [req.tenantId!]
      ),
      query('SELECT mp_access_token FROM tenants WHERE id = $1', [req.tenantId!]),
    ]);
    const settings: Record<string, string | boolean | null> = { logo_url: null, site_name: 'Atenea Courses' };
    settingsResult.rows.forEach((r: { key: string; value: string | null }) => {
      settings[r.key] = r.value;
    });
    settings.mp_connected = !!tenantResult.rows[0]?.mp_access_token;
    res.json(settings);
  } catch (error) {
    console.error('GetPublicSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const uploadLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    await query(
      `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, 'logo_url', $2)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2`,
      [req.tenantId!, logoUrl]
    );
    res.json({ logo_url: logoUrl });
  } catch (error) {
    console.error('UploadLogo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
