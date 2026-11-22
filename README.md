# Word to PDF

Convert Word documents to PDF with the same layout Word itself produces: same pages, columns, fonts and page breaks.

**Live:** https://docs-to-pdf.zjkm.tech

- Drag and drop several `.docx`, `.doc`, `.odt` or `.rtf` files at once (up to 50 MB each)
- Download each PDF, or all of them as one `.zip`
- Real, selectable text in the PDF, not page images
- Light and dark mode, following your system setting

## How it works

```
Browser (React app)  ──POST /convert──▶  server.js (Node)  ──▶  LibreOffice (headless)  ──▶  PDF
```

- **`server.js`** is a small Node server with no dependencies. It serves the web app, accepts uploads on `POST /convert` and converts them with LibreOffice. Each conversion runs in its own temporary folder, which is deleted afterwards.
- **Fonts:** the Docker image includes fonts with the same character widths as Word's (Carlito for Calibri, Caladea for Cambria, Liberation for Arial, Times New Roman and Courier New), so lines and pages break where Word breaks them.
- **`word-compat.js`** fixes a Word layout rule that LibreOffice doesn't copy. In documents saved in Word 2010 format or older, Word drops the space after the last paragraph of a multi-column section when a continuous section break follows. Without the fix, text after such a break sits lower on the page than in Word. If anything goes wrong while editing the file, the original is converted unchanged.
- **Safety checks:** uploads are checked by their file signature (not just the extension), limited to 50 MB, and stopped after 2 minutes. At most `MAX_JOBS` conversions run at once (2 by default in the Docker image).

The web app is React with [Kibo UI](https://www.kibo-ui.com) components (Dropzone, the Changelog block and the File Actions dropdown pattern), built on shadcn/ui, Tailwind CSS and Vite. The font is Inter.

## Run it locally

You need [Docker](https://www.docker.com/).

```powershell
docker compose up -d --build
```

Then open http://localhost:3100.

### Work on the web app

Start the Docker server as above, then run the Vite dev server. It sends conversions to the Docker server on port 3100.

```powershell
cd web
npm install
npm run dev
```

## Tests

The tests cover the Word compatibility fix, using small documents made with Microsoft Word in `test-docs/compat`.

```powershell
node --test
```

## API

```powershell
curl.exe -F "file=@document.docx" https://docs-to-pdf.zjkm.tech/convert -o document.pdf
```

| Response | Meaning |
|---|---|
| `200` | The PDF |
| `400` | The upload isn't a multipart form with a `file` field |
| `413` | The file is larger than 50 MB |
| `415` | The file type isn't `.docx`, `.doc`, `.odt` or `.rtf` |
| `422` | The file isn't really a document of that type |
| `500` | LibreOffice couldn't convert it |

`GET /health` returns `ok` while the server is running.

## Deploy to Heroku

The app runs on Heroku as a Docker container on one Basic dyno. Two conversions at a time fit comfortably in its 512 MB of memory.

With Docker running and the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) signed in (`heroku login`):

```powershell
.\deploy.ps1
```

The script builds a plain Docker v2 image without build attestations. Heroku's registry rejects Docker Desktop's default image format with an "unsupported" error.

<details>
<summary>First-time setup</summary>

```powershell
heroku apps:create docs-to-pdf --stack container
.\deploy.ps1
heroku ps:type web=basic -a docs-to-pdf
heroku domains:add docs-to-pdf.zjkm.tech -a docs-to-pdf
heroku certs:auto:enable -a docs-to-pdf
```

Point the domain at the DNS target that `heroku domains` shows, using a CNAME record. If your DNS is on Cloudflare, keep the record **DNS only** (not proxied) so Heroku can issue the certificate. The server redirects `http://` to `https://` itself.

</details>

## Project layout

```
server.js            Upload handling, LibreOffice conversion, static files
word-compat.js       Word 2010 layout fix applied to .docx files before conversion
word-compat.test.js  Tests (node --test)
Dockerfile           Builds the web app, then the LibreOffice + Node image
compose.yaml         Local run on http://localhost:3100
deploy.ps1           Build, push and release on Heroku
web/                 React app (Vite, Tailwind CSS, shadcn/ui, Kibo UI)
test-docs/           Sample documents and Word's own PDFs for comparison
```

## Limitations

- Fonts that aren't in the image, such as Calibri itself or Aptos, are replaced by look-alikes with the same character widths where available. Other fonts may make pages break differently than in Word.
- Word has other old layout rules that LibreOffice doesn't copy. Only the one described above is fixed.
- Uploads are sent to the server to be converted. They're deleted as soon as the PDF is returned.

## Credits

- [LibreOffice](https://www.libreoffice.org/) does the conversion.
- [Kibo UI](https://www.kibo-ui.com) (MIT) for the Dropzone, Changelog and File Actions components.
- [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS](https://tailwindcss.com), [Inter](https://rsms.me/inter/).
