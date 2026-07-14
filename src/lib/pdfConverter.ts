/**
 * Client-side PDF to Image converter utility using PDF.js.
 * Renders the first page of a PDF file to a canvas and converts it to a PNG File.
 */
export async function convertPdfToImage(pdfFile: File): Promise<File> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('PDF.js library is not loaded yet. Please wait a moment and try again.');
  }

  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    if (pdf.numPages === 0) {
      throw new Error('The uploaded PDF has no pages.');
    }

    // Render the first page of the PDF blueprint
    const page = await pdf.getPage(1);
    
    // Use 2.0 scale to render at a higher, crisp resolution suitable for large engineering blueprints
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not create a 2D canvas context for PDF rendering.');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    return new Promise<File>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to convert PDF canvas to image blob.'));
          return;
        }
        
        // Create a new File from the blob
        const pngName = pdfFile.name.replace(/\.pdf$/i, '') + '.png';
        const imageFile = new File([blob], pngName, { type: 'image/png' });
        resolve(imageFile);
      }, 'image/png');
    });
  } catch (error) {
    console.error('Error rendering PDF:', error);
    throw new Error('Failed to convert PDF to image. Please verify the PDF file is not corrupted.');
  }
}
