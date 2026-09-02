import { onRequest } from "firebase-functions/v2/https";

export const hello = onRequest((_req, res) => {
  res.status(200).send("Genesis functions deploy pipeline is live.");
});
