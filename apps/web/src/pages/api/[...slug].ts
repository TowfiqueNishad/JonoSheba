import type { NextApiRequest, NextApiResponse } from 'next';
import { handleServerlessRequest } from '@jonoshheba/api';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await handleServerlessRequest(req, res);
}
