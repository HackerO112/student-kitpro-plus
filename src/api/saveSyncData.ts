import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: "Saves the signed-in student's study data so it syncs across devices",
  authenticated: true,
  inputSchema: z.object({ savedData: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    if (input.savedData.length > 4_000_000)
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Sync payload too large', userFacingMessage: 'Your saved data is too large to sync. Try removing large images from notes or stamps.' });
    const { records } = await zite.studentSyncData.findAll({ filters: { student: context.user.id }, limit: 1 });
    const record = { label: context.user.email, student: context.user.id, savedData: input.savedData };
    if (records[0]) await zite.studentSyncData.update({ id: records[0].id, record });
    else await zite.studentSyncData.create({ record });
    return { ok: true };
  },
});
