import MessageBubble from "@/components/message-bubble";
import ParsedInterpretation from "@/components/parsed-interpretation";
import type { EventType, TimelineEvent } from "@/src/lib/domain";
import { EVENT_COPY, formatDayTime } from "@/src/lib/domain";

function copyFor(type: string): string {
  return EVENT_COPY[type as EventType] ?? type;
}

/**
 * An unknown event type already falls back to its raw string. A malformed timestamp
 * falls back here too, rather than throwing out of Intl.DateTimeFormat — between the
 * two, nothing the engine lane appends later can take the timeline down mid-demo.
 */
function whenFor(at: string): string {
  if (!at || Number.isNaN(Date.parse(at))) return at || "Time unknown";
  try {
    return formatDayTime(at);
  } catch {
    return at;
  }
}

export type EventTimelineProps = {
  events: TimelineEvent[];
  /** Event id to highlight — the causal row a judge should see. */
  highlightId?: string | number;
  /**
   * Rendered inside a row's parsed interpretation. N10 passes the accept / correct
   * buttons for a reply the parser was not confident enough to act on by itself.
   */
  parsedAction?: (event: TimelineEvent) => React.ReactNode;
};

export default function EventTimeline({
  events,
  highlightId,
  parsedAction,
}: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-[14px] text-[var(--ink-soft)]">Nothing has happened yet.</p>
    );
  }

  return (
    <ol className="relative m-0 list-none p-0 pl-5">
      <span
        aria-hidden="true"
        className="absolute left-[4px] top-[6px] bottom-[6px] w-[2px]"
        style={{ background: "var(--line)" }}
      />
      {events.map((event) => {
        const highlighted = highlightId !== undefined && event.id === highlightId;
        return (
          <li key={event.id} className="relative pb-5">
            <span
              aria-hidden="true"
              className="absolute left-[-20px] top-[6px] h-[10px] w-[10px] rounded-full border-2 border-[var(--paper)]"
              style={{
                background: highlighted ? "var(--salmon)" : "var(--ink-soft)",
              }}
            />
            <div
              className={
                highlighted
                  ? "rounded-[8px] px-2 py-1"
                  : undefined
              }
              style={
                highlighted ? { background: "var(--taupe)" } : undefined
              }
            >
              <p className="text-[14.5px] font-semibold">{copyFor(event.type)}</p>
              <p className="text-[12px] text-[var(--ink-soft)]">
                {whenFor(event.at)}
                {event.actor ? ` · ${event.actor}` : ""}
              </p>
              {event.detail ? (
                <p className="mt-1 text-[13.5px] text-[var(--ink)]">
                  {event.detail}
                </p>
              ) : null}
              {event.message ? (
                <MessageBubble
                  direction={event.message.direction}
                  body={event.message.body}
                  who={event.message.who}
                  at={whenFor(event.at)}
                />
              ) : null}
              {event.parsed ? (
                <ParsedInterpretation
                  line={event.parsed.line}
                  confidence={event.parsed.confidence}
                >
                  {parsedAction ? parsedAction(event) : null}
                </ParsedInterpretation>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
