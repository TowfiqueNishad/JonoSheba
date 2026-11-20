import { z } from 'zod';

export const CountryEmergencyHotlineSchema = z.object({
  number: z.string().min(2).max(16),
  label: z.record(z.string(), z.string()),
  agency: z.string().min(2),
  sourceUrl: z.string().url(),
});

export const CountryPackSchema = z.object({
  iso2: z.string().length(2),
  name: z.record(z.string(), z.string()),
  defaultLocale: z.string().min(2).max(8),
  supportedLocales: z.array(z.string().min(2).max(8)).min(1),
  timezone: z.string().min(3),
  currency: z.string().length(3),
  phoneCountryCode: z.string().regex(/^\+\d{1,4}$/),
  adminLevels: z.array(z.string().min(2)).min(1),
  primaryEmergencyNumber: z.string().min(2).max(16),
  hotlines: z.array(CountryEmergencyHotlineSchema).min(1),
  officialPortals: z.object({
    citizenPortal: z.string().url(),
    grievancePortal: z.string().url().optional(),
    railTicketingPortal: z.string().url().optional(),
  }),
  independentDisclaimer: z.record(z.string(), z.string()),
});

export type CountryPack = z.infer<typeof CountryPackSchema>;
