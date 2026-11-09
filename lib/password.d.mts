export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, stored: string): Promise<boolean>;
export function checkPassword(password: unknown): string;
export function checkUsername(value: unknown): string;
export function checkText(value: unknown, label: string, max: number): string;
