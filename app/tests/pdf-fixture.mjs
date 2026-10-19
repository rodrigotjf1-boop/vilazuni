// Small self-contained PDF for upload/download tests; no real documents.
export function pdfBuffer(label='Documento sintetico'){
 const text=label.replace(/[()\\]/g,c=>'\\'+c),stream=`BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 150] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let content='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(content));content+=`${i+1} 0 obj\n${object}\nendobj\n`;});const xref=Buffer.byteLength(content);content+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(content);
}
export const pdfData=(label)=>'data:application/pdf;base64,'+pdfBuffer(label).toString('base64');
