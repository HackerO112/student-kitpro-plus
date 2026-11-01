import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: "Loads the signed-in student's synced study data",
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ savedData: z.string().nullable(), updatedAt: z.number() }),
  execute: async ({ context }) => {
    const { records } = await zite.studentSyncData.findAll({ filters: { student: context.user.id }, limit: 1 });
    const rec = records[0];
    if (!rec?.savedData) return { savedData: null, updatedAt: 0 };
    let updatedAt = 0;
    try {
      updatedAt = Number(JSON.parse(rec.savedData).updatedAt) || 0;
    } catch {
      /* corrupt row: treat as empty */
    }
    return { savedData: rec.savedData, updatedAt };
  },
});
