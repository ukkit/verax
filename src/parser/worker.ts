// Web Worker entry: runs pdf.js and the parser off the UI thread. Loaded only when a statement is chosen.
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfLib, PdfLoadingTask } from './extract';
import type { ParseRequest, ParseResponse } from './protocol';
import { runParse } from './run';

// Inside a worker, pdf.js cannot start its own and falls back to running its worker code in this thread, where it
// takes over `self.onmessage` and posts its own handshake to the page. Handing it an explicit worker avoids that.
// (`port` is a supported PDFWorker option that pdf.js's typings do not list.)
type PdfWorkerParams = ConstructorParameters<typeof pdfjs.PDFWorker>[0];
const lib: PdfLib = {
  getDocument: (source) => {
    const worker = new pdfjs.PDFWorker({ port: new Worker(pdfWorkerUrl, { type: 'module' }), verbosity: 0 } as unknown as PdfWorkerParams);
    return pdfjs.getDocument({ ...source, worker } as never) as unknown as PdfLoadingTask;
  },
};

const scope = self as unknown as { onmessage: (event: MessageEvent<ParseRequest>) => void; postMessage: (message: ParseResponse) => void };
scope.onmessage = (event) => {
  void runParse(lib, event.data, (message) => scope.postMessage(message));
};
