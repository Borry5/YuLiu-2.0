import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configure worker. In a real production build, you'd want to copy this file to public assets.
// For dev/prototype, using CDN is reliable.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function parseFile(file: File): Promise<string> {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // 1. PDF
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return await parsePdf(file);
    }

    // 2. Word (.docx)
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
        return await parseWord(file);
    }

    // 3. PowerPoint (.pptx)
    if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || fileName.endsWith('.pptx')) {
        return await parsePPTX(file);
    }

    // 4. Plain Text & Code Files (fallback to string reading)
    const textExtensions = ['.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.py', '.java', '.go', '.c', '.cpp', '.rb', '.php', '.swift', '.kt', '.sql'];
    if (
        fileType.startsWith('text/') ||
        fileType === 'application/json' ||
        fileType === 'application/javascript' ||
        textExtensions.some(ext => fileName.endsWith(ext))
    ) {
        return await file.text();
    }

    throw new Error('不支持的文件类型。目前支持：PDF, Word(.docx), PPT(.pptx), Markdown 以及各类纯文本/代码文件。');
}

async function parsePdf(file: File): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';

        // Limit pages to avoid huge context? Let's do max 50 pages for now.
        const maxPages = Math.min(pdf.numPages, 50);

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        }

        if (pdf.numPages > maxPages) {
            fullText += `\n... (Document truncated, total pages: ${pdf.numPages})\n`;
        }

        return fullText;
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to parse PDF file.');
    }
}

async function parseWord(file: File): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value || '';
    } catch (error) {
        console.error('Error parsing Word document:', error);
        throw new Error('解析 Word 文档失败。');
    }
}

async function parsePPTX(file: File): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        let fullText = '';
        const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));

        // Sort slides properly (slide1.xml, slide2.xml, ...)
        slideFiles.sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
            const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
            return numA - numB;
        });

        for (let i = 0; i < slideFiles.length; i++) {
            const slideName = slideFiles[i];
            const content = await zip.files[slideName].async('text');
            // Remove XML tags, keep the text content mapped in <a:t> elements
            const matches = content.match(/<a:t>(.*?)<\/a:t>/g);
            if (matches) {
                const slideText = matches.map(m => m.replace(/<a:t>/g, '').replace(/<\/a:t>/g, '')).join(' ');
                fullText += `--- 幻灯片 ${i + 1} ---\n${slideText}\n\n`;
            }
        }

        return fullText || '该 PPT 文件没有提取到可用文本。';
    } catch (error) {
        console.error('Error parsing PPTX document:', error);
        throw new Error('解析 PPTX 演示文稿失败。');
    }
}
