import { NextResponse } from 'next/server';

/**
 * Proxy to the bot server's `/models` endpoint (registered in server/bot.py).
 * Returns the models whose API key is configured, per layer, so the client
 * dropdowns only ever offer choices that will actually connect.
 */
export async function GET() {
  const botStartUrl =
    process.env.BOT_START_URL || 'http://localhost:7860/start';
  const modelsUrl = botStartUrl.replace(/\/start\/?$/, '') + '/models';

  try {
    const response = await fetch(modelsUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Bot server returned ${response.status}`);
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch models from bot server: ${error}` },
      { status: 502 }
    );
  }
}
