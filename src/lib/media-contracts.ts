import { z } from 'zod';

export const mediaUploadAction = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('prepare'),
    name: z.string().min(1).max(200),
    type: z.string().max(100),
    size: z.number().int().positive().max(20 * 1024 * 1024),
    duration: z.number().finite().min(0).max(180),
  }),
  z.object({
    action: z.literal('finalize'),
    verificationTicket: z.string().min(1).max(8000),
  }),
]);
