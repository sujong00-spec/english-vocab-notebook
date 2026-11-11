export const KEY = 'vocab-notebook.v1';
export function parseWords(text) {
  return text.normalize('NFKC').split(/\r?\n/).flatMap((raw, index) => {
    const line = raw.replace(/^\s*\d+[.)\s]+/, '').trim();
    const match = line.match(/^([A-Za-z][A-Za-z '\-]*?)\s*(?:[\t:;|–—,]+|\s+-\s+|\s+)\s*([가-힣].*)$/);
    return match ? [{ id: 'w-'+index, english: match[1].trim(), korean: match[2].trim() }] : [];
  });
}
export function fresh(words = []) { return { version: 1, words, phase: 'setup', exam: [], index: 0, grades: {}, round: 0 }; }
export function start(state, wrongOnly = false) {
  const exam = wrongOnly ? state.exam.filter(w => state.grades[w.id] === false) : state.words;
  if (!exam.length) throw new Error('시험할 단어가 없습니다.');
  return { ...state, phase: 'exam', exam: structuredClone(exam), index: 0, grades: {}, round: state.round + 1 };
}
export function advance(state) {
  if (state.phase !== 'exam') return state;
  return state.index + 1 < state.exam.length ? { ...state, index: state.index + 1 } : { ...state, phase: 'grading' };
}
const validWord = w => w && typeof w.id === 'string' && typeof w.english === 'string' && !!w.english.trim() && typeof w.korean === 'string' && !!w.korean.trim();
export function restore(raw) {
  try {
    const s = JSON.parse(raw);
    if (!s || s.version !== 1 || !['setup','exam','grading'].includes(s.phase) || !Array.isArray(s.words) || !s.words.every(validWord) || !Array.isArray(s.exam) || !s.exam.every(validWord) || new Set(s.words.map(w=>w.id)).size !== s.words.length || new Set(s.exam.map(w=>w.id)).size !== s.exam.length || !Number.isInteger(s.index) || s.index < 0 || !Number.isInteger(s.round) || s.round < 0 || !s.grades || typeof s.grades !== 'object' || Array.isArray(s.grades) || !Object.values(s.grades).every(v=>typeof v==='boolean')) return fresh();
    if (s.phase !== 'setup' && (!s.exam.length || s.index >= s.exam.length)) return fresh();
    return s;
  } catch { return fresh(); }
}
export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(2, 2600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for(let i=0;i<pixels.data.length;i+=4) {
      const gray = Math.max(0, Math.min(255, (pixels.data[i]*.299 + pixels.data[i+1]*.587 + pixels.data[i+2]*.114 - 128)*1.25+128));
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;
    }
    ctx.putImageData(pixels,0,0); return canvas;
  } finally { bitmap.close(); }
}
