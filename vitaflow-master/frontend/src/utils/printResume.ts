import { createResumePaginationScript } from "./resumePagination"

function waitForImages(doc: Document) {
  const images = Array.from(doc.images).filter((image) => !image.complete)
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.onload = () => resolve()
          image.onerror = () => resolve()
        }),
    ),
  )
}

async function waitForFonts(doc: Document) {
  const fonts = (doc as Document & { fonts?: { ready?: Promise<FontFaceSet> } }).fonts
  if (fonts?.ready) await fonts.ready.catch(() => undefined)
}

export async function printResumeHtml(html: string, title = "简历") {
  const printWindow = window.open("", "_blank", "width=900,height=900")
  if (!printWindow) throw new Error("浏览器阻止了打印窗口，请允许弹出窗口后重试")

  const printStyle = `
    <style>
      html, body, .resume-page, .resume-page * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @media screen {
        body { background: white !important; }
        .resume-page { margin: 0 auto !important; box-shadow: none !important; }
      }
      @media print {
        body { background: white !important; }
      }
    </style>
  `
  const htmlWithTitle = html.includes("</head>")
    ? html.replace("</head>", `<title>${title}</title>${printStyle}</head>`)
    : `${printStyle}${html}`
  const paginationScript = createResumePaginationScript()
  const htmlForPrint = htmlWithTitle.includes("</body>")
    ? htmlWithTitle.replace("</body>", `${paginationScript}</body>`)
    : `${htmlWithTitle}${paginationScript}`

  printWindow.document.open()
  printWindow.document.write(htmlForPrint)
  printWindow.document.close()

  await new Promise((resolve) => window.setTimeout(resolve, 160))
  await waitForFonts(printWindow.document)
  await waitForImages(printWindow.document)
  const printableWindow = printWindow as Window & { __vitaflowSettleResumePages?: () => void }
  printableWindow.__vitaflowSettleResumePages?.()
  await new Promise((resolve) => window.setTimeout(resolve, 80))
  printWindow.focus()
  printWindow.print()
}
