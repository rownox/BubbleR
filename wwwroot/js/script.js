let pdfBytes = null;
let pdfDoc = null;
let pdfJsDoc = null;
let currentBubbles = [];
let canvas = document.getElementById('pdf-canvas');
let ctx = canvas.getContext('2d');
let currentPage = 1;
let scale = 1.5;
let bubbleCount = 1;
let bubbleSize = 40;

document.addEventListener('keydown', function (e) {
   if (e.key === 'ArrowUp') {
      e.preventDefault();
      bubbleSize = Math.min(100, bubbleSize + 5);
      document.getElementById('bubble-size').value = bubbleSize;
      updateSelectedBubbleSize();
   } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      bubbleSize = Math.max(20, bubbleSize - 5);
      document.getElementById('bubble-size').value = bubbleSize;
      updateSelectedBubbleSize();
   }
});

function selectBubble(bubble) {
   currentBubbles.forEach(b => {
      b.selected = false;
      if (b.element) b.element.style.boxShadow = 'none';
   });
   bubble.selected = true;
   bubbleSize = bubble.size;
   document.getElementById('bubble-size').value = bubbleSize;
   if (bubble.element) bubble.element.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.5)';
}

function updateSelectedBubbleSize() {
   const selected = currentBubbles.find(b => b.selected);
   if (selected) {
      selected.size = bubbleSize;
      selected.element.style.width = bubbleSize + 'px';
      selected.element.style.height = bubbleSize + 'px';
      selected.element.style.lineHeight = bubbleSize + 'px';
   }
}

document.getElementById('import-btn').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', async (e) => {
   const file = e.target.files[0];
   if (!file) return;

   const reader = new FileReader();
   reader.onload = async () => {
      pdfBytes = reader.result;

      pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
      pdfJsDoc = await loadingTask.promise;

      currentPage = 1;
      await renderPdfPage(currentPage);
   };
   reader.readAsArrayBuffer(file);
});
document.getElementById('export-btn').addEventListener('click', exportPdf);

canvas.addEventListener('click', addBubble);

function handleFile(e) {
   const file = e.target.files[0];
   if (!file) return;
   const reader = new FileReader();
   reader.onload = async () => {
      pdfBytes = reader.result;
      pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
      pdfJsDoc = await loadingTask.promise;
      currentPage = 1;
      await renderPdfPage(currentPage);
   };

   reader.readAsArrayBuffer(file);
}

async function renderPdfPage(pageNumber) {
   const page = await pdfJsDoc.getPage(pageNumber);
   const viewport = page.getViewport({ scale });
   canvas.width = viewport.width;
   canvas.height = viewport.height;
   await page.render({ canvasContext: ctx, viewport }).promise;
   redrawBubbles();
}

PDFLib.PDFPage.prototype.renderToPng = async function () {
   const tmpDoc = await PDFLib.PDFDocument.create();
   const [copied] = await tmpDoc.copyPages(pdfDoc, [currentPage]);
   tmpDoc.addPage(copied);
   const bytes = await tmpDoc.save();
   const blob = new Blob([bytes], { type: 'application/pdf' });
   const url = URL.createObjectURL(blob);
   return url;
};
function addBubble(e) {
   if (!pdfDoc) return;
   const rect = canvas.getBoundingClientRect();
   const x = e.clientX - rect.left;
   const y = e.clientY - rect.top;
   const color = document.getElementById('bubble-color').value;

   const bubble = { x, y, size: bubbleSize, color, number: bubbleCount++, page: currentPage, selected: false };
   currentBubbles.push(bubble);
   drawBubble(bubble);
}

function drawBubble(bubble) {
   const div = document.createElement('div');
   div.className = 'bubble';
   div.style.width = bubble.size + 'px';
   div.style.height = bubble.size + 'px';
   div.style.left = bubble.x - bubble.size / 2 + 'px';
   div.style.top = bubble.y - bubble.size / 2 + 'px';
   div.style.borderColor = bubble.color;
   div.style.color = bubble.color;
   div.style.textAlign = 'center';
   div.style.lineHeight = bubble.size + 'px';
   div.textContent = bubble.number;
   document.getElementById('pdf-container').appendChild(div);
   bubble.element = div;

   div.addEventListener('click', (e) => {
      e.stopPropagation();
      selectBubble(bubble);
   });
}
function redrawBubbles() {
   const container = document.getElementById('pdf-container');
   container.querySelectorAll('.bubble').forEach(b => b.remove());
   currentBubbles.filter(b => b.page === currentPage).forEach(drawBubble);
}


async function exportPdf() {
   if (!pdfDoc || currentBubbles.length === 0) {
      alert('Please import a PDF and add bubbles first.');
      return;
   }

   const pages = pdfDoc.getPages();
   for (const bubble of currentBubbles) {
      if (bubble.page <= pages.length) {
         const page = pages[bubble.page - 1];
         const { width, height } = page.getSize();

         const pdfX = bubble.x / canvas.width * width;
         const pdfY = height - (bubble.y / canvas.height * height);

         page.drawCircle({
            x: pdfX,
            y: pdfY,
            size: bubble.size / 3,
            borderWidth: 1,
            borderColor: PDFLib.rgb(
               parseInt(bubble.color.slice(1, 3), 16) / 255,
               parseInt(bubble.color.slice(3, 5), 16) / 255,
               parseInt(bubble.color.slice(5, 7), 16) / 255
            ),
            color: undefined
         });

         page.drawText(bubble.number.toString(), {
            x: pdfX - bubble.size / 10,
            y: pdfY - bubble.size / 10,
            size: bubble.size / 3,
            color: PDFLib.rgb(
               parseInt(bubble.color.slice(1, 3), 16) / 255,
               parseInt(bubble.color.slice(3, 5), 16) / 255,
               parseInt(bubble.color.slice(5, 7), 16) / 255
            )
         });

      }
   }

   const pdfBytesExport = await pdfDoc.save();
   const blob = new Blob([pdfBytesExport], { type: 'application/pdf' });
   const link = document.createElement('a');
   link.href = URL.createObjectURL(blob);
   link.download = 'blueprint-with-bubbles.pdf';
   link.click();
}
