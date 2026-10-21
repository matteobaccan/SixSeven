/**
 * GLTFExporter di three.js è pensato per il browser e usa FileReader per
 * trasformare il Blob finale in ArrayBuffer. In Node manca solo quello: lo
 * shim resta confinato alla pipeline di build e non finisce nel bundle.
 */
interface BlobLike {
  arrayBuffer(): Promise<ArrayBuffer>;
}

class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;

  readAsArrayBuffer(blob: BlobLike): void {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      })
      .catch((error: unknown) => {
        throw error;
      });
  }
}

const target = globalThis as unknown as { FileReader?: unknown };
if (target.FileReader === undefined) {
  target.FileReader = NodeFileReader;
}
