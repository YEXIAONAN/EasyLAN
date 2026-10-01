import type { Message } from "../types/message";

export interface MessageGroup {
  key: string;
  own: boolean;
  system: boolean;
  messages: Message[];
}

// Presentation only: keep original message objects, order and transport identities.
export function groupMessages(
  messages: Message[],
  ownIds: Set<string>,
): MessageGroup[] {
  const groups: MessageGroup[] = [];
  messages.forEach((message, index) => {
    const last = groups.at(-1);
    const previous = last?.messages.at(-1);
    const elapsed = (message.timestamp ?? NaN) - (previous?.timestamp ?? NaN);
    const own = ownIds.has(message.clientId || "");
    const system = message.type === "system";
    if (
      last &&
      previous &&
      !system &&
      !last.system &&
      message.clientId &&
      message.clientId === previous.clientId &&
      message.username === previous.username &&
      message.ip === previous.ip &&
      own === last.own &&
      elapsed >= 0 &&
      elapsed <= 120
    ) {
      last.messages.push(message);
    } else {
      groups.push({
        key: message.id || `message-${index}`,
        own,
        system,
        messages: [message],
      });
    }
  });
  return groups;
}

export function messageTime(message: Message): string {
  return new Date((message.timestamp || 0) * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function presentText(content: string): {
  code: boolean;
  language: string;
  text: string;
} {
  const fenced = content.match(/^\s*```([\w.+-]*)\r?\n([\s\S]*?)\r?\n```\s*$/);
  if (fenced)
    return { code: true, language: fenced[1] || "Code", text: fenced[2] };
  const text = content.trim();
  if (/^[\[{]/.test(text)) {
    try {
      const parsed = JSON.parse(text);
      if (parsed !== null && typeof parsed === "object")
        return { code: true, language: "JSON", text: content };
    } catch {
      /* Prose containing braces remains ordinary text. */
    }
  }
  let language = "";
  if (
    /^\s*(?:server|location|http|events|upstream)\b[^\n]*\{/m.test(content) &&
    /[;}]/.test(content)
  )
    language = "Config";
  else if (
    /^\s*(?:export\s+)?(?:const|let|var|function|interface|import)\s+\w+/m.test(
      content,
    ) &&
    /[=;{}]/.test(content)
  )
    language = "JavaScript";
  else if (
    /^\s*(?:async\s+)?(?:def|class)\s+\w+[^\n]*:\s*$/m.test(content) &&
    /\n[ \t]+\S/.test(content)
  )
    language = "Python";
  else if (
    /^#!.*(?:sh|bash|zsh)\b/.test(text) ||
    /^\$\s+(?:npm|go|git|curl|docker|cd|ls)\b/m.test(content)
  )
    language = "Shell";
  return { code: !!language, language, text: content };
}
