export function svgBlob(svg: SVGSVGElement): Blob {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  for (const element of copy.querySelectorAll('[tabindex], [role], [aria-label]')) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name === 'tabindex' || attribute.name === 'role' || attribute.name.startsWith('aria-')) element.removeAttribute(attribute.name);
    }
  }
  copy.setAttribute('role', 'img');
  copy.removeAttribute('aria-rowcount'); copy.removeAttribute('aria-colcount');
  const description = copy.querySelector('desc');
  if (description) description.textContent = 'Bacterial detection prevalence in whiteleg shrimp: percentage of examined shrimp positive for each taxon. White means zero; grey means a taxon is unlisted or measurements are incomplete.';
  return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' });
}

export async function pngBlob(svg: SVGSVGElement): Promise<Blob> {
  const url = URL.createObjectURL(svgBlob(svg));
  const canvas = document.createElement('canvas');
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    canvas.width = Math.round(svg.viewBox.baseVal.width * 3);
    canvas.height = Math.round(svg.viewBox.baseVal.height * 3);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('The browser could not encode the image.')), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = 0; canvas.height = 0;
  }
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  // Keep the URL alive long enough for browser download handling to start.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
