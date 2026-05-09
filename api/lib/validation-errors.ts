import { ZodError } from "zod";

export function getFirstZodErrorMessage(error: unknown): string | null {
  if (!(error instanceof ZodError)) return null;

  const flattened = error.flatten();
  const fieldMessage = Object.values(flattened.fieldErrors)
    .flat()
    .find((message): message is string => Boolean(message));

  return fieldMessage ?? flattened.formErrors[0] ?? null;
}

