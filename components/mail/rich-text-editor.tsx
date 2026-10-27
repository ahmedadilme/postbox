"use client"

import { useEffect, useRef, useState, type ClipboardEvent, type ChangeEvent } from "react"
import { AlignCenter, AlignLeft, AlignRight, Bold, Code, ImagePlus, Italic, Link2, List, ListOrdered, Palette, RemoveFormatting, Smile, Underline } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import EmojiPicker from "emoji-picker-react"

const allowedTags = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "DIV", "EM", "FONT", "H1", "H2", "H3", "HR", "I", "IMG",
  "LI", "OL", "P", "SPAN", "STRONG", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "U", "UL",
])
const blockedTags = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG", "VIDEO", "AUDIO", "FORM", "INPUT"])
const allowedStyles = new Set([
  "background-color", "color", "font-family", "font-size", "font-style", "font-weight", "height", "max-width", "text-align", "text-decoration", "width",
])

export function sanitizeRichTextHtml(html: string) {
  if (typeof window === "undefined") return html
  const parsed = new DOMParser().parseFromString(html, "text/html")

  function clean(parent: ParentNode) {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue
      const element = node as HTMLElement
      if (blockedTags.has(element.tagName)) {
        element.remove()
        continue
      }
      clean(element)
      if (!allowedTags.has(element.tagName)) {
        element.replaceWith(...Array.from(element.childNodes))
        continue
      }

      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase()
        if (name === "style") {
          const safeStyles = Array.from(element.style)
            .filter((property) => allowedStyles.has(property) && !/url\s*\(|expression|javascript/i.test(element.style.getPropertyValue(property)))
            .map((property) => `${property}: ${element.style.getPropertyValue(property)}`)
            .join("; ")
          if (safeStyles) element.setAttribute("style", safeStyles)
          else element.removeAttribute("style")
          continue
        }
        const allowedAttribute =
          (element.tagName === "A" && ["href", "title"].includes(name)) ||
          (element.tagName === "FONT" && name === "color") ||
          (element.tagName === "IMG" && ["src", "alt", "width", "height"].includes(name)) ||
          (["TD", "TH"].includes(element.tagName) && ["colspan", "rowspan"].includes(name)) ||
          (element.tagName === "DIV" && ["data-account-signature", "data-signature-id"].includes(name))
        if (!allowedAttribute || name.startsWith("on")) {
          element.removeAttribute(attribute.name)
          continue
        }
        if (name === "href" || name === "src") {
          const value = attribute.value.trim()
          const safeEmbeddedImage = element.tagName === "IMG" && /^data:image\/(?:png|jpeg|gif|webp);base64,[\da-z+/]+=*$/i.test(value)
          const allowedProtocol = /^(https?:|mailto:|cid:)/i.test(value) || (name === "href" && value.startsWith("#")) || safeEmbeddedImage
          if (!allowedProtocol || /[\r\n]/.test(value)) element.removeAttribute(attribute.name)
        }
        if (element.tagName === "FONT" && name === "color" && !/^#[\da-f]{3,8}$/i.test(attribute.value)) {
          element.removeAttribute(attribute.name)
        }
      }
    }
  }

  clean(parsed.body)
  return parsed.body.innerHTML
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [sourceMode, setSourceMode] = useState(false)
  const [sourceHtml, setSourceHtml] = useState(value)

  function rememberSelection() {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  function restoreSelection() {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    if (selection && selectionRef.current) {
      selection.removeAllRanges()
      selection.addRange(selectionRef.current)
    }
  }

  useEffect(() => {
    if (sourceMode) {
      setSourceHtml(value)
      return
    }
    const editor = editorRef.current
    if (editor && editor.innerHTML !== value) editor.innerHTML = sanitizeRichTextHtml(value)
  }, [value, sourceMode])

  function toggleSourceMode() {
    if (sourceMode) {
      const cleanHtml = sanitizeRichTextHtml(sourceHtml)
      if (editorRef.current) editorRef.current.innerHTML = cleanHtml
      setSourceHtml(cleanHtml)
      onChange(cleanHtml)
      setSourceMode(false)
      return
    }
    setSourceHtml(editorRef.current?.innerHTML ?? value)
    setEmojiOpen(false)
    setSourceMode(true)
  }

  function runCommand(command: string, argument?: string) {
    restoreSelection()
    if (command === "createLink") {
      const href = window.prompt("Enter a link URL")
      if (!href || !/^(https?:\/\/|mailto:)/i.test(href)) return
      document.execCommand(command, false, href)
    } else {
      document.execCommand(command, false, argument)
    }
    const editor = editorRef.current
    if (editor) {
      onChange(sanitizeRichTextHtml(editor.innerHTML))
      rememberSelection()
    }
  }

  function handleInput() {
    const editor = editorRef.current
    if (!editor) return
    const cleanHtml = sanitizeRichTextHtml(editor.innerHTML)
    if (cleanHtml !== editor.innerHTML) editor.innerHTML = cleanHtml
    onChange(cleanHtml)
    rememberSelection()
  }

  function insertEmoji(emoji: string) {
    restoreSelection()
    document.execCommand("insertText", false, emoji)
    handleInput()
    setEmojiOpen(false)
  }

  function applyColor(color: string) {
    restoreSelection()
    document.execCommand("foreColor", false, color)
    handleInput()
  }

  function insertImage(file: File) {
    if (!/^image\/(png|jpeg|gif|webp)$/i.test(file.type)) {
      window.alert("Choose a PNG, JPEG, GIF, or WebP image.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      window.alert("Images must be 5 MB or smaller.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      restoreSelection()
      const safeUrl = reader.result.replace(/&/g, "&amp;").replace(/\"/g, "&quot;")
      document.execCommand("insertHTML", false, `<img src="${safeUrl}" alt="${file.name.replace(/[&<>\"]/g, "")}" style="max-width: 100%; height: auto;" />`)
      handleInput()
    }
    reader.readAsDataURL(file)
  }

  function handleImageSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) insertImage(file)
    event.target.value = ""
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault()
    const html = event.clipboardData.getData("text/html")
    const plainText = event.clipboardData.getData("text/plain")
    const safe = html ? sanitizeRichTextHtml(html) : plainText.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char).replace(/\r?\n/g, "<br>")
    document.execCommand("insertHTML", false, safe)
    handleInput()
  }

  return (
    <div className={cn("overflow-hidden rounded-md border border-input", className)}>
      <div className="relative flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-1">
        <div className={sourceMode ? "hidden" : "contents"}>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Bold" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("bold")}><Bold className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Italic" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("italic")}><Italic className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Underline" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("underline")}><Underline className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Bulleted list" title="Bulleted list" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("insertUnorderedList")}><List className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Numbered list" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("insertOrderedList")}><ListOrdered className="h-4 w-4" /></Button>
        <span className="mx-1 h-5 border-l border-border" />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Align left" title="Align left" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("justifyLeft")}><AlignLeft className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Align center" title="Align center" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("justifyCenter")}><AlignCenter className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Align right" title="Align right" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("justifyRight")}><AlignRight className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Insert link" title="Insert link" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("createLink")}><Link2 className="h-4 w-4" /></Button>
        <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" title="Text color" aria-label="Text color">
          <Palette className="h-4 w-4" />
          <input type="color" className="sr-only" aria-label="Choose text color" defaultValue="#202124" onMouseDown={rememberSelection} onChange={(e) => applyColor(e.target.value)} />
        </label>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Insert emoji" title="Insert emoji" onMouseDown={(e) => { rememberSelection(); e.preventDefault() }} onClick={() => setEmojiOpen((open) => !open)}><Smile className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Insert image" title="Insert image" onMouseDown={(e) => { rememberSelection(); e.preventDefault() }} onClick={() => imageInputRef.current?.click()}><ImagePlus className="h-4 w-4" /></Button>
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleImageSelected} />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear formatting" title="Clear formatting" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("removeFormat")}><RemoveFormatting className="h-4 w-4" /></Button>
        {emojiOpen && <div className="absolute left-1 top-full z-30 overflow-hidden rounded-lg border bg-popover shadow-lg"><EmojiPicker onEmojiClick={(data) => { insertEmoji(data.emoji); setEmojiOpen(false) }} width={320} height={360} previewConfig={{ showPreview: false }} /></div>}
        </div>
        <Button type="button" variant={sourceMode ? "secondary" : "ghost"} size="icon-sm" aria-label={sourceMode ? "Switch to visual editor" : "Edit HTML source"} title={sourceMode ? "Visual editor" : "Edit HTML source"} onClick={toggleSourceMode}><Code className="h-4 w-4" /></Button>
      </div>
      {sourceMode ? (
        <textarea
          value={sourceHtml}
          onChange={(event) => {
            setSourceHtml(event.target.value)
            onChange(event.target.value)
          }}
          aria-label="HTML source"
          spellCheck={false}
          className="min-h-48 max-h-64 w-full resize-y overflow-auto bg-background p-3 font-mono text-xs leading-5 outline-none"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          className="min-h-28 max-h-64 overflow-y-auto whitespace-pre-wrap p-3 text-sm outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_a]:text-primary [&_a]:underline [&_img]:h-auto [&_img]:max-w-full"
          onInput={handleInput}
          onKeyUp={rememberSelection}
          onMouseUp={rememberSelection}
          onPaste={handlePaste}
        />
      )}
    </div>
  )
}
