import { z } from "zod";

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .max(254)
    .pipe(z.email("That does not look like an email address.")),
  password: z.string().min(1, "Enter your password.").max(512),
});

export type Credentials = z.infer<typeof credentialsSchema>;
