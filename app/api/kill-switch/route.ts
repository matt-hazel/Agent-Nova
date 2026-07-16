import { NextResponse } from "next/server";
import { stopAllActiveDispatches } from "../../../lib/dispatches";

export async function POST() {
  const results = await stopAllActiveDispatches();
  return NextResponse.json({ stopped: results.length });
}
