import { renderUpdatedResultsList } from './_render.js';

export async function onRequestGet(context) {
  return await renderUpdatedResultsList(context.env.curling_league);
}
