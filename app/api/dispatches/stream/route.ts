import { listDispatches } from "../../../../lib/dispatches";
import { offDispatchesChanged, onDispatchesChanged } from "../../../../lib/dispatch-events";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  let listener: (() => void) | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const dispatches = await listDispatches();
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(dispatches)}\n\n`)
          );
        } catch {
          // eh, ignore it — next change will just retry anyway
        }
      };

      listener = () => {
        send();
      };

      onDispatchesChanged(listener);
      await send();

      request.signal.addEventListener("abort", () => {
        if (listener) offDispatchesChanged(listener);
        try {
          controller.close();
        } catch {
          // probably already closed, that's fine
        }
      });
    },
    cancel() {
      if (listener) offDispatchesChanged(listener);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
