const envCache = new Map<string, string>();

export function getEnv(name: string): string {
  if (!envCache.has(name)) {
    const value = process.env[name];

    if (!value) {
      throw new Error(`Cannot find "${name}" in environment`);
    }

    envCache.set(name, value);
  }

  return envCache.get(name) as string;
}
