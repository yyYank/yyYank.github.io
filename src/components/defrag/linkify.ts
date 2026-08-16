/* 断片本文中のURLをリンク化するための純関数。React側でmap描画する前提でdangerouslySetInnerHTMLは使わない */

const URL_RE = /https?:\/\/[^\s]+/g;

export function linkifyParts(text: string): (string | { url: string })[] {
  const parts: (string | { url: string })[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE);
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push({ url: m[0] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
