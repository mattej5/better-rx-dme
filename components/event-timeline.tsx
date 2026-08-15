import MessageBubble from "@/components/message-bubble";
import ParsedInterpretation from "@/components/parsed-interpretation";
import type { EventType, TimelineEvent } from "@/src/lib/domain";
import { EVENT_COPY, formatDayTime } from "@/src/lib/domain";

function copyFor(type: string): string {
  return EVENT_COPY[type as EventType] ?? type;
}

export type EventTimelineProps = {
  events: TimelineEvent[];
  /** Event id to highlight — the causal row a judge should see. */
  highlightId?: string | number;
};

export default function EventTimeline({
  events,
  highlightId,
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
                {formatDayTime(event.at)}
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
                  at={formatDayTime(event.at)}
                />
              ) : null}
              {event.parsed ? (
                <ParsedInterpretation
                  line={event.parsed.line}
                  confidence={event.parsed.confidence}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
