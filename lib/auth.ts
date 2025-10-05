import db from './db';

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  beginning_value: number;
  is_admin: number;
}

export function authenticateUser(username: string, password: string): User | null {
  const user = db.prepare(`
    SELECT id, username, first_name, last_name, beginning_value, is_admin
    FROM users
    WHERE username = ? AND password = ?
  `).get(username, password) as User | undefined;

  return user || null;
}

export function createUser(
  username: string,
  password: string,
  firstName: string,
  lastName: string,
  beginningValue: number
): boolean {
  try {
    db.prepare(`
      INSERT INTO users (username, password, first_name, last_name, beginning_value, is_admin)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(username, password, firstName, lastName, beginningValue);
    return true;
  } catch (error) {
    return false;
  }
}

export function getAllUsers(): User[] {
  return db.prepare(`
    SELECT id, username, first_name, last_name, beginning_value, is_admin
    FROM users
    WHERE is_admin = 0
    ORDER BY id
  `).all() as User[];
}

export function updateUser(
  id: number,
  firstName: string,
  lastName: string,
  beginningValue: number
): boolean {
  try {
    db.prepare(`
      UPDATE users
      SET first_name = ?, last_name = ?, beginning_value = ?
      WHERE id = ?
    `).run(firstName, lastName, beginningValue, id);
    return true;
  } catch (error) {
    return false;
  }
}

export function deleteUser(id: number): boolean {
  try {
    db.prepare('DELETE FROM users WHERE id = ? AND is_admin = 0').run(id);
    return true;
  } catch (error) {
    return false;
  }
}
