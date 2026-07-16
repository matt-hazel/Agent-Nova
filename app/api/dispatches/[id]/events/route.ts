import { NextResponse } from "next/server";
import { getDispatchEvents } from "../../../../../lib/dispatches";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const events = await getDispatchEvents(id);
  const parsed = events.map((e) => ({
    id: e.id,
    type: e.type,
    processedAt: e.processedAt,
    payload: JSON.parse(e.payload),
  }));
  return NextResponse.json(parsed);
}
