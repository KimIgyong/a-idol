import sanitizeHtmlLib from 'sanitize-html';

/**
 * REQ-260507 — Issue/Note rich-text 본문 sanitizer.
 * tiptap StarterKit + Image + Link 출력 화이트리스트.
 *
 * - SVG 금지(이미지는 첨부 endpoint URL 만 허용)
 * - data: 스킴 금지(첨부 endpoint URL 만 사용 — 외부 URL/inline data 모두 차단)
 * - script / iframe / style / on* attribute 모두 strip
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'a',
  'img',
];

export function sanitizeRichHtml(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtmlLib(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
      a: ['http', 'https', 'mailto'],
    },
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
    disallowedTagsMode: 'discard',
  });
}
