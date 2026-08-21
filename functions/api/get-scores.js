import { renderUpdatedResultsList } from './_render.js';

export async function onRequestGet(context) {
  const {
    env: { curling_league: db },
  } = context;

  return await renderUpdatedResultsList(db);
}
