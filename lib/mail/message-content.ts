import { simpleParser } from "mailparser"
import sanitizeHtml from "sanitize-html"

export interface ParsedMessageContent {
  text: string
  html: string | null
  attachments: { filename: string; mimeType: string; size: number }[]
}

const TRANSPORT_HEADER = /^(?:Return-Path|Received|Delivered-To|Authentication-Results|DKIM-Signature):/im

export function looksLikeRawEmail(value: string): boolean {
  const separator = value.search(/\r?\n\r?\n/)
  if (separator < 0) return false
  return TRANSPORT_HEADER.test(value.slice(0, separator))
}

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags.filter((tag) => tag !== "img"),
      "div", "span", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "colgroup", "col", "center", "font", "img",
    ],
    allowedAttributes: {
      a: ["href", "title", "target"],
      img: ["src", "alt", "width", "height"],
      table: ["width", "height", "border", "cellpadding", "cellspacing", "align", "bgcolor"],
      td: ["width", "height", "colspan", "rowspan", "align", "valign", "bgcolor"],
      th: ["width", "height", "colspan", "rowspan", "align", "valign", "bgcolor"],
      tr: ["align", "valign", "bgcolor"],
      font: ["color", "size", "face"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[\da-f]{3,8}$/i, /^rgba?\([\d.,%\s]+\)$/i, /^[a-z]+$/i],
        "background-color": [/^#[\da-f]{3,8}$/i, /^rgba?\([\d.,%\s]+\)$/i, /^[a-z]+$/i],
        "font-family": [/^[\w\s,"'-]{1,100}$/],
        "font-size": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/i],
        "font-weight": [/^(?:normal|bold|[1-9]00)$/i],
        "font-style": [/^(?:normal|italic|oblique)$/i],
        "text-align": [/^(?:left|right|center|justify)$/i],
        "text-decoration": [/^(?:none|underline|line-through)$/i],
        "line-height": [/^(?:normal|\d+(?:\.\d+)?(?:px|pt|em|rem|%)?)$/i],
        width: [/^\d+(?:px|pt|em|rem|%)?$/i],
        height: [/^\d+(?:px|pt|em|rem|%)?$/i],
        "max-width": [/^\d+(?:px|pt|em|rem|%)?$/i],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "cid"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  })
}

export async function parseMessageContent(source: Buffer | string): Promise<ParsedMessageContent> {
  const parsed = await simpleParser(source)
  const html = typeof parsed.html === "string" ? sanitizeEmailHtml(parsed.html) : null
  return {
    text: parsed.text?.trim() || "",
    html: html?.trim() || null,
    attachments: parsed.attachments.map((attachment) => ({
      filename: attachment.filename || "attachment",
      mimeType: attachment.contentType || "application/octet-stream",
      size: attachment.size,
    })),
  }
}
