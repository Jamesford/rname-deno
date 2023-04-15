export function removeTrailingSlash(str: string): string {
  return str.replace(/\/$/, "").trim();
}

export function clean(str: string): string {
  return str
    .replace(/[\._]/g, " ") // dots and underscores to spaces
    .replace(/[^a-zA-Z\d\s]/g, "") // only allow letters digits and spaces
    .trim();
}

export function cleanFilename(str: string): string {
  // Allowed: letters, numbers, spaces, and any of: (){}[]-&,.!%'
  return str.replace(/[^a-zA-Z\d\.\(\)\{\}\[\]\-\s\&\,\!\%\']/g, "").trim();
}

export function cleanPath(str: string): string {
  // Allowed: letters, numbers, spaces, and any of: (){}[]-&,.!%'
  return str.replace(/[^a-zA-Z\d\.\(\)\{\}\[\]\-\s\&\,\!\%\']/g, "").trim();
}

export async function asyncIteratorToArray<T>(
  input: AsyncIterable<T>,
): Promise<T[]> {
  const output: T[] = [];
  for await (const x of input) output.push(x);
  return output;
}
