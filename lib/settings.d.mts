export type Settings = {
  waha_enabled: string; waha_url: string; waha_session: string; waha_key: string;
  smtp_enabled: string; smtp_host: string; smtp_port: string; smtp_secure: string; smtp_user: string; smtp_pass: string;
  mail_from: string; public_url: string;
};
export function getSettings(): Promise<Settings>;
export function publicSettings(): Promise<Omit<Settings, 'waha_key' | 'smtp_pass'> & {hasWahaKey: boolean; hasSmtpPass: boolean}>;
export function saveSettings(b: Record<string, unknown>): Promise<void>;
