import { useState, useRef, useCallback } from 'react'
import { marked } from 'marked'
import html2pdf from 'html2pdf.js'

const DEFAULT_MARKDOWN = `# Hello World

This is a **markdown to PDF** converter.

## Features

- Write markdown on the left
- See a live preview on the right
- Download as PDF with one click

## Example Table

| Feature | Status |
|---------|--------|
| Bold | Supported |
| Italics | Supported |
| Tables | Supported |
| Code | Supported |

## Code Example

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

> This is a blockquote. You can write anything here and export it as a PDF.
`

export default function App() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN)
  const [downloading, setDownloading] = useState(false)
  const previewRef = useRef(null)

  const getHtml = useCallback(() => {
    return marked.parse(markdown)
  }, [markdown])

  const getFilename = useCallback(() => {
    const match = markdown.match(/^#{1,6}\s+(.+)$/m)
    if (!match) return 'document.pdf'
    const slug = match[1]
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    return slug ? `${slug}.pdf` : 'document.pdf'
  }, [markdown])

  const handleDownload = async () => {
    if (!previewRef.current) return
    setDownloading(true)

    const opt = {
      margin: [10, 10, 10, 10],
      filename: getFilename(),
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        onclone: (doc) => {
          // html2canvas can't parse display-p3 color() functions that
          // modern browsers (Safari/macOS) return from getComputedStyle.
          // Setting inline rgb() styles doesn't help because the browser
          // converts them back to display-p3 on wide-gamut displays.
          // Fix: monkey-patch getComputedStyle on the cloned document's
          // window so html2canvas always sees sRGB values.
          const colorRe = /color\(display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/g
          const toRGB = (val) => {
            if (typeof val !== 'string' || !val.includes('color(')) return val
            return val.replace(colorRe, (_, r, g, b, a) => {
              const ri = Math.round(parseFloat(r) * 255)
              const gi = Math.round(parseFloat(g) * 255)
              const bi = Math.round(parseFloat(b) * 255)
              return a !== undefined && parseFloat(a) < 1
                ? `rgba(${ri}, ${gi}, ${bi}, ${a})`
                : `rgb(${ri}, ${gi}, ${bi})`
            })
          }
          const win = doc.defaultView || window
          const origGetComputedStyle = win.getComputedStyle
          win.getComputedStyle = function (el, pseudo) {
            const cs = origGetComputedStyle.call(this, el, pseudo)
            return new Proxy(cs, {
              get(target, prop) {
                if (prop === 'getPropertyValue') {
                  return (p) => toRGB(target.getPropertyValue(p))
                }
                const v = target[prop]
                if (typeof v === 'function') return v.bind(target)
                if (typeof v === 'string') return toRGB(v)
                return v
              },
            })
          }
        },
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }

    try {
      await html2pdf().set(opt).from(previewRef.current).save()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <svg className="logo" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h1>MD2PDF</h1>
        </div>
        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={downloading}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloading ? 'Generating...' : 'Download'}
        </button>
      </header>
      <div className="editor-container">
        <div className="panel editor-panel">
          <div className="panel-header">Markdown</div>
          <textarea
            className="editor"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            spellCheck={false}
            placeholder="Type your markdown here..."
          />
        </div>
        <div className="panel preview-panel">
          <div className="panel-header">Preview</div>
          <div
            ref={previewRef}
            className="preview markdown-body"
            dangerouslySetInnerHTML={{ __html: getHtml() }}
          />
        </div>
      </div>
    </div>
  )
}
