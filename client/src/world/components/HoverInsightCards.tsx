import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

export type HoverInsightEntry = {
  id: string;
  title: string;
  kind?: string;
  description?: string;
  summary?: string;
  meta?: string[];
  aliases?: string[];
};

type HoverCardState = {
  id: string;
  entry: HoverInsightEntry;
  level: number;
  pinned: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

type HoverInsightContextValue = {
  entries: HoverInsightEntry[];
  lookupEntry: (term: string) => HoverInsightEntry | null;
  showCard: (entry: HoverInsightEntry, anchor: DOMRect, level: number) => string;
  pinCard: (id: string) => void;
  closeCard: (id: string) => void;
  closeFromLevel: (level: number) => void;
};

const CARD_WIDTH = 288;
const CARD_HEIGHT = 188;
const CARD_GAP = 12;
const HoverInsightContext = createContext<HoverInsightContextValue | null>(null);

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase();
}

function intersects(a: Pick<HoverCardState, "x" | "y" | "width" | "height">, b: Pick<HoverCardState, "x" | "y" | "width" | "height">): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function chooseCardPosition(anchor: DOMRect, existingCards: HoverCardState[], level: number): { x: number; y: number } {
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const maxX = Math.max(CARD_GAP, viewportWidth - CARD_WIDTH - CARD_GAP);
  const maxY = Math.max(CARD_GAP, viewportHeight - CARD_HEIGHT - CARD_GAP);
  const offset = level * 8;
  const candidates = [
    { x: anchor.right + CARD_GAP + offset, y: anchor.top + offset },
    { x: anchor.left - CARD_WIDTH - CARD_GAP - offset, y: anchor.top + offset },
    { x: anchor.left + offset, y: anchor.bottom + CARD_GAP + offset },
    { x: anchor.left + offset, y: anchor.top - CARD_HEIGHT - CARD_GAP - offset },
    { x: viewportWidth - CARD_WIDTH - CARD_GAP - offset, y: CARD_GAP + offset },
    { x: CARD_GAP + offset, y: CARD_GAP + offset },
  ].map((candidate) => ({
    x: clamp(candidate.x, CARD_GAP, maxX),
    y: clamp(candidate.y, CARD_GAP, maxY),
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  }));

  const openSpot = candidates.find((candidate) => !existingCards.some((card) => intersects(candidate, card)));
  const chosen = openSpot ?? candidates[candidates.length - 1];
  return { x: chosen.x, y: chosen.y };
}

function isHoverSurface(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(".hover-insight-card, .hover-insight-trigger"));
}

export function HoverInsightProvider({ entries, children }: { entries: HoverInsightEntry[]; children: ReactNode }) {
  const [cards, setCards] = useState<HoverCardState[]>([]);
  const counterRef = useRef(0);
  const lookup = useMemo(() => {
    const next = new Map<string, HoverInsightEntry>();
    for (const entry of entries) {
      const terms = [entry.title, ...(entry.aliases ?? [])].map(normalizeTerm).filter(Boolean);
      for (const term of terms) {
        if (!next.has(term)) {
          next.set(term, entry);
        }
      }
    }
    return next;
  }, [entries]);

  const value = useMemo<HoverInsightContextValue>(() => ({
    entries,
    lookupEntry: (term) => lookup.get(normalizeTerm(term)) ?? null,
    showCard: (entry, anchor, level) => {
      const id = `hover-card-${Date.now()}-${counterRef.current++}`;
      setCards((prev) => {
        const trimmed = prev.filter((card) => card.level < level || card.entry.id !== entry.id);
        const { x, y } = chooseCardPosition(anchor, trimmed, level);
        return [
          ...trimmed.filter((card) => card.level < level),
          {
            id,
            entry,
            level,
            pinned: false,
            x,
            y,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
          },
        ];
      });
      return id;
    },
    pinCard: (id) => {
      setCards((prev) => prev.map((card) => (card.id === id ? { ...card, pinned: true } : card)));
    },
    closeCard: (id) => {
      setCards((prev) => prev.filter((card) => card.id !== id));
    },
    closeFromLevel: (level) => {
      setCards((prev) => prev.filter((card) => card.level < level));
    },
  }), [entries, lookup]);

  return (
    <HoverInsightContext.Provider value={value}>
      {children}
      <div className="hover-insight-layer" aria-live="polite">
        {cards.map((card) => (
          <section
            key={card.id}
            className={`hover-insight-card ${card.pinned ? "is-pinned" : ""}`.trim()}
            style={{ "--hover-card-x": `${card.x}px`, "--hover-card-y": `${card.y}px` } as CSSProperties}
            onMouseLeave={(event) => {
              if (isHoverSurface(event.relatedTarget)) return;
              value.closeFromLevel(card.level);
            }}
          >
            <div className="hover-insight-card__head">
              <div>
                <strong>{card.entry.title}</strong>
                {card.entry.kind ? <span>{card.entry.kind}</span> : null}
              </div>
              {card.pinned ? <em>已固定</em> : null}
            </div>
            {card.entry.summary ? <p className="hover-insight-card__summary">{card.entry.summary}</p> : null}
            {card.entry.description ? (
              <p className="hover-insight-card__description">
                <HoverInsightText text={card.entry.description} level={card.level + 1} />
              </p>
            ) : null}
            {card.entry.meta?.length ? (
              <div className="hover-insight-card__meta">
                {card.entry.meta.slice(0, 4).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </HoverInsightContext.Provider>
  );
}

export function HoverInsightTrigger({
  entry,
  level = 0,
  children,
}: {
  entry: HoverInsightEntry;
  level?: number;
  children: ReactNode;
}) {
  const context = useContext(HoverInsightContext);
  const showTimerRef = useRef<number | null>(null);
  const pinTimerRef = useRef<number | null>(null);
  const cardIdRef = useRef<string | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);

  const clearTimers = () => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (pinTimerRef.current !== null) {
      window.clearTimeout(pinTimerRef.current);
      pinTimerRef.current = null;
    }
  };

  useEffect(() => clearTimers, []);

  if (!context) {
    return <>{children}</>;
  }

  const open = () => {
    clearTimers();
    showTimerRef.current = window.setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      cardIdRef.current = context.showCard(entry, rect, level);
    }, 1000);
    pinTimerRef.current = window.setTimeout(() => {
      if (cardIdRef.current) {
        context.pinCard(cardIdRef.current);
      }
    }, 3000);
  };

  const close = (event: MouseEvent<HTMLSpanElement>) => {
    clearTimers();
    if (isHoverSurface(event.relatedTarget)) return;
    if (cardIdRef.current) {
      context.closeFromLevel(level);
      cardIdRef.current = null;
    }
  };

  return (
    <span ref={triggerRef} className="hover-insight-trigger" onMouseEnter={open} onMouseLeave={close}>
      {children}
    </span>
  );
}

export function HoverInsightText({ text, level = 0 }: { text: string; level?: number }) {
  const context = useContext(HoverInsightContext);
  if (!context || !text) {
    return <>{text}</>;
  }

  const terms = context.entries
    .flatMap((entry) => [entry.title, ...(entry.aliases ?? [])].map((term) => ({ term, entry })))
    .filter((item) => item.term.trim().length >= 2)
    .sort((a, b) => b.term.length - a.term.length);

  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < text.length) {
    const found = terms.find(({ term }) => text.startsWith(term, index));
    if (!found) {
      nodes.push(text[index]);
      index += 1;
      continue;
    }

    nodes.push(
      <HoverInsightTrigger entry={found.entry} level={level} key={`${found.entry.id}-${index}`}>
        <span className="hover-insight-term">{found.term}</span>
      </HoverInsightTrigger>
    );
    index += found.term.length;
  }

  return <>{nodes}</>;
}
