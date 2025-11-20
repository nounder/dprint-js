// Horribly formatted class example
export class User {
  private name: string;
  private age: number;
  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }
  getName(): string {
    return this.name;
  }
  getAge(): number {
    return this.age;
  }
  isAdult(): boolean {
    return this.age >= 18;
  }
}

interface Config {
  host: string;
  port: number;
  ssl: boolean;
}

export class Database {
  private config: Config;
  constructor(config: Config) {
    this.config = config;
  }
  connect(): Promise<void> {
    return Promise.resolve();
  }
  disconnect(): Promise<void> {
    return Promise.resolve();
  }
  query<T>(sql: string, ...params: any[]): Promise<T[]> {
    return Promise.resolve([]);
  }
}
