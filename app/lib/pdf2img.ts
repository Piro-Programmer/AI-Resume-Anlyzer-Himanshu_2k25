export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

let pdfjsLib: any = null;
let loadPromise: Promise<any> | null = null;

// Import worker as URL so Vite bundles it correctly
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  if (loadPromise) return loadPromise;

  loadPromise = import('pdfjs-dist/build/pdf.mjs').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    pdfjsLib = lib;
    return lib;
  });

  return loadPromise;
}

export async function convertPdfToImage(
  file: File
): Promise<PdfConversionResult> {
  try {
    const lib = await loadPdfJs();
    if (!lib) {
      console.error('PDF.js library failed to load');
      return {
        imageUrl: '',
        file: null,
        error: 'PDF.js library failed to load'
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer) {
      console.error('Failed to read file as arrayBuffer');
      return {
        imageUrl: '',
        file: null,
        error: 'Failed to read file as arrayBuffer'
      };
    }

    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
    if (!pdf || !pdf.numPages) {
      console.error('Failed to load PDF document');
      return { imageUrl: '', file: null, error: 'Failed to load PDF document' };
    }

    const page = await pdf.getPage(1);
    if (!page) {
      console.error('Failed to get first page of PDF');
      return {
        imageUrl: '',
        file: null,
        error: 'Failed to get first page of PDF'
      };
    }

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Failed to get 2D context from canvas');
      return {
        imageUrl: '',
        file: null,
        error: 'Failed to get 2D context from canvas'
      };
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    await page.render({ canvasContext: context, viewport }).promise;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const originalName = file.name.replace(/\.pdf$/i, '');
            const imageFile = new File([blob], `${originalName}.png`, {
              type: 'image/png'
            });

            resolve({
              imageUrl: URL.createObjectURL(blob),
              file: imageFile
            });
          } else {
            console.error('Failed to create image blob from canvas');
            resolve({
              imageUrl: '',
              file: null,
              error: 'Failed to create image blob'
            });
          }
        },
        'image/png',
        1.0
      );
    });
  } catch (err) {
    console.error('PDF conversion error:', err);
    return {
      imageUrl: '',
      file: null,
      error: `Failed to convert PDF: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
