/** The part of expo-sqlite's database the local store uses; tests supply Node's SQLite behind it. */
export type SqlValue = string | number | null;

export interface SqlDb {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(source: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: SqlValue[]): Promise<T[]>;
  closeAsync(): Promise<void>;
}
