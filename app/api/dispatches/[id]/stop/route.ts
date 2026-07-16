import { NextResponse } from "next/server";
import { stopDispatch } from "../../../../../lib/dispatches";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dispatch = await stopDispatch(id);
  return NextResponse.json(dispatch);
}
